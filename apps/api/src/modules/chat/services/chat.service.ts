import * as crypto from 'node:crypto'

import {
  Injectable,
  Logger,
  type MessageEvent,
  NotFoundException
} from '@nestjs/common'
import {
  TelemetryLevel,
  TelemetryRuntimeFamily,
  TelemetryService,
  TelemetryStatus
} from '@workspace/codepath-common/telemetry'
import { and, desc, eq } from 'drizzle-orm'
import { map } from 'lodash'
import { from, type Observable } from 'rxjs'

import { chatHistory, chatSessions, repos } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import {
  type OrchestratorChatStreamEvent,
  OrchestratorClient,
  OrchestratorClientError
} from '../../orchestrator-client/services/orchestrator-client.service'
import { emitTelemetry } from '../../telemetry/services/telemetry'
import { AskDto } from '../dto/ask.dto'

// FIXME ENUMS :)

@Injectable()
export class ChatService {
  private logger: Logger = new Logger(ChatService.name)

  constructor(
    private readonly dbService: DbService,
    private readonly orchestratorClient: OrchestratorClient
  ) { }

  async askAboutRepo(userId: number, repoId: number, body: AskDto): Promise<Observable<MessageEvent>> {
    const { question, sessionId } = body
    await this.assertSessionOwnership(userId, repoId, sessionId)

    this.logger.log(`Repo: ${repoId}, Q: ${question}`)
    emitTelemetry({
      component: 'chat.service',
      event: 'chat_request_received',
      level: TelemetryLevel.INFO,
      repoId,
      runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
      service: TelemetryService.WEB_API,
      status: TelemetryStatus.OK
    })

    await this.dbService.dbClient.insert(chatHistory).values({
      content: question,
      role: 'user',
      sessionId,
      userId
    })

    return from(this.streamChatJob({ prompt: question, repoId }, { sessionId, userId }))
  }

  async createSession(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

    await this.dbService.dbClient.insert(chatSessions).values({
      id: crypto.randomUUID(),
      name: `Session for repo ${repoId}`,
      repoId,
      userId
    })
  }

  async getChatSessionDetails(userId: number, repoId: number, sessionId: string) {
    await this.assertSessionOwnership(userId, repoId, sessionId)

    const sessionDetails = await this.dbService.dbClient.select().from(chatHistory)
      .where(and(
        eq(chatHistory.userId, userId),
        eq(chatHistory.sessionId, sessionId)
      )).orderBy(desc(chatHistory.createdAt))

    return map(sessionDetails, detail => ({
      content: detail.content,
      id: detail.id,
      role: detail.role
    }))
  }

  async getRepoChats(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

    const sessions = await this.dbService.dbClient.select().from(chatSessions)
      .where(and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.repoId, repoId)
      )).orderBy(desc(chatSessions.createdAt))

    return map(sessions, session => ({
      createdAt: session.createdAt,
      sessionId: session.id,
      sessionName: session.name
    }))
  }

  private async assertRepoOwnership(userId: number, repoId: number): Promise<void> {
    const [repo] = await this.dbService.dbClient.select({ id: repos.id }).from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) throw new NotFoundException('Repository not found')
  }

  private async assertSessionOwnership(userId: number, repoId: number, sessionId: string): Promise<void> {
    const [session] = await this.dbService.dbClient.select({ id: chatSessions.id })
      .from(chatSessions)
      .where(and(
        eq(chatSessions.id, sessionId),
        eq(chatSessions.repoId, repoId),
        eq(chatSessions.userId, userId)
      )).limit(1)

    if (!session) throw new NotFoundException('Session not found')
  }

  private emitStreamFailureTelemetry(
    correlationId: string,
    repoId: number,
    startedAt: number,
    event: Extract<OrchestratorChatStreamEvent, { type: 'error' }>
  ): void {
    emitTelemetry({
      component: 'chat.rpc',
      correlationId,
      details: {
        errorCode: event.code,
        errorMessage: event.message
      },
      durationMs: Date.now() - startedAt,
      event: 'chat_rpc_stream_error_received',
      level: TelemetryLevel.ERROR,
      queueName: 'chat',
      repoId,
      runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
      service: TelemetryService.WEB_API,
      status: TelemetryStatus.ERROR
    })
  }

  private async *streamChatJob(segments: {
    prompt: string
    repoId: number
  }, persistence: {
    sessionId: string
    userId: number
  }): AsyncGenerator<MessageEvent> {
    const correlationId = crypto.randomUUID()
    const startedAt = Date.now()
    let answer = ''

    try {
      emitTelemetry({
        component: 'chat.rpc',
        correlationId,
        event: 'chat_rpc_request_published',
        level: TelemetryLevel.INFO,
        queueName: 'chat',
        repoId: segments.repoId,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.OK
      })

      for await (const event of this.orchestratorClient.streamChatRpc(segments)) {
        if (event.type === 'chunk') {
          answer += event.delta
          yield this.toMessageEvent(event)
          continue
        }

        if (event.type === 'error') {
          this.logger.error(`Chat stream failed for repo ${segments.repoId}: [${event.code}] ${event.message}`)
          this.emitStreamFailureTelemetry(correlationId, segments.repoId, startedAt, event)
          yield this.toMessageEvent(event)
          return
        }

        answer += event.delta

        await this.dbService.dbClient.insert(chatHistory).values({
          content: answer,
          role: 'assistant',
          sessionId: persistence.sessionId,
          userId: persistence.userId
        })

        emitTelemetry({
          component: 'chat.rpc',
          correlationId,
          durationMs: Date.now() - startedAt,
          event: 'chat_rpc_response_received',
          level: TelemetryLevel.INFO,
          queueName: 'chat',
          repoId: segments.repoId,
          runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
          service: TelemetryService.WEB_API,
          status: TelemetryStatus.OK
        })

        yield this.toMessageEvent(event)
        return
      }
    } catch (cause) {
      if (cause instanceof OrchestratorClientError && cause.message === 'Orchestrator request timed out') {
        emitTelemetry({
          component: 'chat.rpc',
          correlationId,
          durationMs: Date.now() - startedAt,
          event: 'chat_rpc_timeout',
          level: TelemetryLevel.ERROR,
          queueName: 'chat',
          repoId: segments.repoId,
          runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
          service: TelemetryService.WEB_API,
          status: TelemetryStatus.TIMEOUT
        })
      } else {
        emitTelemetry({
          component: 'chat.rpc',
          correlationId,
          details: {
            errorMessage: cause instanceof Error ? cause.message : String(cause),
            errorName: cause instanceof Error ? cause.name : 'UnknownError'
          },
          event: 'chat_rpc_request_failed',
          level: TelemetryLevel.ERROR,
          queueName: 'chat',
          repoId: segments.repoId,
          runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
          service: TelemetryService.WEB_API,
          status: TelemetryStatus.ERROR
        })
      }

      const timeout = cause instanceof OrchestratorClientError && cause.message === 'Orchestrator request timed out'
      const errorEvent: OrchestratorChatStreamEvent = {
        code: timeout ? 'CHAT_STREAM_UPSTREAM_TIMEOUT' : 'CHAT_STREAM_UPSTREAM_FAILURE',
        message: timeout ? 'The chat response stream timed out.' : 'The chat response stream failed.',
        type: 'error'
      }

      this.logger.error(`Chat stream failed for repo ${segments.repoId}: ${cause instanceof Error ? cause.message : String(cause)}`)
      yield this.toMessageEvent(errorEvent)
    }
  }

  private toMessageEvent(event: OrchestratorChatStreamEvent): MessageEvent {
    if (event.type === 'error') {
      return {
        data: { code: event.code, message: event.message },
        type: event.type
      }
    }

    return {
      data: { delta: event.delta, done: event.done },
      type: event.type
    }
  }
}
