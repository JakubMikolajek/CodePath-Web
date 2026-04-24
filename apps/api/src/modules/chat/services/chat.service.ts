import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import { map } from 'lodash'
import { v4 as uuidv4 } from 'uuid'

import { OrchestratorClientError, requestChatRpc } from '../../../lib/orchestrator-client'
import { emitTelemetry } from '../../../lib/telemetry'
import { chatHistory, chatSessions, repos } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { AskDto } from '../dto/ask.dto'

@Injectable()
export class ChatService {
  private logger: Logger = new Logger(ChatService.name)

  constructor(
    private readonly dbService: DbService
  ) { }

  async askAboutRepo(userId: number, repoId: number, body: AskDto) {
    const { question, sessionId } = body
    await this.assertSessionOwnership(userId, repoId, sessionId)

    this.logger.log(`Repo: ${repoId}, Q: ${question}`)
    emitTelemetry({
      component: 'chat.service',
      event: 'chat_request_received',
      level: 'info',
      repoId,
      runtimeFamily: 'pipeline',
      service: 'web-api',
      status: 'ok'
    })

    await this.dbService.dbClient.insert(chatHistory).values({
      content: question,
      role: 'user',
      sessionId,
      userId
    })

    const answer = await this.publishChatJob({ prompt: question, repoId })

    await this.dbService.dbClient.insert(chatHistory).values({
      content: answer,
      role: 'assistant',
      sessionId,
      userId
    })

    return answer
  }

  async createSession(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

    await this.dbService.dbClient.insert(chatSessions).values({
      id: uuidv4(),
      name: `Session for repo ${repoId}`,
      repoId,
      userId
    })
  }

  async getChatSessionDetails(userId: number, repoId: number, sessionId: string) {
    await this.assertSessionOwnership(userId, repoId, sessionId)

    const sessionDetails = await this.dbService.dbClient.select()
      .from(chatHistory)
      .where(
        and(
          eq(chatHistory.userId, userId),
          eq(chatHistory.sessionId, sessionId)
        )
      ).orderBy(desc(chatHistory.createdAt))

    return map(sessionDetails, detail => ({
      content: detail.content,
      id: detail.id,
      role: detail.role
    }))
  }

  async getRepoChats(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

    const sessions = await this.dbService.dbClient.select()
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.userId, userId),
          eq(chatSessions.repoId, repoId)
        )
      ).orderBy(desc(chatSessions.createdAt))

    return map(sessions, session => ({
      createdAt: session.createdAt,
      sessionId: session.id,
      sessionName: session.name
    }))
  }

  private async assertRepoOwnership(userId: number, repoId: number): Promise<void> {
    const [repo] = await this.dbService.dbClient.select({
      id: repos.id
    })
      .from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) {
      throw new NotFoundException('Repository not found')
    }
  }

  private async assertSessionOwnership(userId: number, repoId: number, sessionId: string): Promise<void> {
    const [session] = await this.dbService.dbClient.select({
      id: chatSessions.id
    })
      .from(chatSessions)
      .where(
        and(
          eq(chatSessions.id, sessionId),
          eq(chatSessions.repoId, repoId),
          eq(chatSessions.userId, userId)
        )
      )
      .limit(1)

    if (!session) {
      throw new NotFoundException('Session not found')
    }
  }

  private async publishChatJob(segments: {
    prompt: string
    repoId: number
  }): Promise<string> {
    const correlationId = uuidv4()
    const startedAt = Date.now()

    try {
      emitTelemetry({
        component: 'chat.rpc',
        correlationId,
        event: 'chat_rpc_request_published',
        level: 'info',
        queueName: 'chat',
        repoId: segments.repoId,
        runtimeFamily: 'pipeline',
        service: 'web-api',
        status: 'ok'
      })

      const answer = await requestChatRpc(segments)

      emitTelemetry({
        component: 'chat.rpc',
        correlationId,
        durationMs: Date.now() - startedAt,
        event: 'chat_rpc_response_received',
        level: 'info',
        queueName: 'chat',
        repoId: segments.repoId,
        runtimeFamily: 'pipeline',
        service: 'web-api',
        status: 'ok'
      })

      return answer
    } catch (cause) {
      if (cause instanceof OrchestratorClientError && cause.message === 'Orchestrator request timed out') {
        emitTelemetry({
          component: 'chat.rpc',
          correlationId,
          durationMs: Date.now() - startedAt,
          event: 'chat_rpc_timeout',
          level: 'error',
          queueName: 'chat',
          repoId: segments.repoId,
          runtimeFamily: 'pipeline',
          service: 'web-api',
          status: 'timeout'
        })
      } else if (cause instanceof OrchestratorClientError && cause.message === 'Orchestrator chat response payload was invalid') {
        emitTelemetry({
          component: 'chat.rpc',
          correlationId,
          event: 'chat_rpc_invalid_payload',
          level: 'error',
          queueName: 'chat',
          repoId: segments.repoId,
          runtimeFamily: 'pipeline',
          service: 'web-api',
          status: 'error'
        })
      } else if (cause instanceof OrchestratorClientError && cause.message === 'Orchestrator response body was not valid JSON') {
        emitTelemetry({
          component: 'chat.rpc',
          correlationId,
          event: 'chat_rpc_response_parse_failed',
          level: 'error',
          queueName: 'chat',
          repoId: segments.repoId,
          runtimeFamily: 'pipeline',
          service: 'web-api',
          status: 'error'
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
          level: 'error',
          queueName: 'chat',
          repoId: segments.repoId,
          runtimeFamily: 'pipeline',
          service: 'web-api',
          status: 'error'
        })
      }

      throw cause
    }
  }
}
