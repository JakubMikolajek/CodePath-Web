import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import * as amqp from 'amqplib'
import { and, desc, eq } from 'drizzle-orm'
import { map } from 'lodash'
import { v4 as uuidv4 } from 'uuid'

import { env } from '../../config/env'
import { emitTelemetry } from '../../lib/telemetry'
import { DbService } from '../db/db.service'
import { chatHistory, chatSessions } from '../db/schema'
import { EmbeddingService } from '../embedding/embedding.service'
import { ensureQueueTopology } from '../rabbitmq/topology'
import { AskDto } from './dto/ask.dto'

@Injectable()
export class ChatService {
  private channel: amqp.Channel
  private conn: amqp.ChannelModel
  private logger: Logger = new Logger(ChatService.name)
  private readonly queue = 'chat'
  private readonly retryDelayMs = env.rabbitRetryDelayMs

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly httpService: HttpService,
    private readonly dbService: DbService
  ) { }

  async askAboutRepo(userId: number, repoId: number, body: AskDto) {
    const { question, sessionId } = body
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

    const answer = await this.publishChatJob({
      prompt: question,
      repoId
    })

    await this.dbService.dbClient.insert(chatHistory).values({
      content: answer,
      role: 'assistant',
      sessionId,
      userId
    })

    return answer
  }

  async createSession(userId: number, repoId: number) {
    await this.dbService.dbClient.insert(chatSessions).values({
      id: uuidv4(),
      name: `Session for repo ${repoId}`,
      repoId,
      userId
    })
  }

  async getChatSessionDetails(userId: number, sessionId: string) {
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

  async onModuleDestroy() {
    await this.channel?.close()
    await this.conn?.close()
  }

  async onModuleInit() {
    this.conn = await amqp.connect(env.rabbitUrl)
    this.channel = await this.conn.createChannel()
    await ensureQueueTopology(this.channel, {
      queueName: this.queue,
      retryDelayMs: this.retryDelayMs
    }, {
      allowRecreateOnMismatch: env.rabbitAllowDestructiveMigration
    })
  }

  private async publishChatJob(segments: {
    prompt: string
    repoId: number
  }): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const correlationId = uuidv4()
      const timeoutMs = 60_000
      const startedAt = Date.now()

      const { queue: replyTo } = await this.channel.assertQueue('', {
        autoDelete: true,
        exclusive: true
      })

      let timer: NodeJS.Timeout | undefined

      const onMessage = (msg: amqp.ConsumeMessage | null) => {
        if (!msg) return
        try {
          if (msg.properties.correlationId !== correlationId) {
            this.channel.ack(msg)
            return
          }
          const data = JSON.parse(msg.content.toString())
          const answer = data?.response

          this.channel.ack(msg)
          this.channel.cancel(consumerTag).catch(() => {})

          if (timer) {
            clearTimeout(timer)
          }

          if (typeof answer !== 'string') {
            emitTelemetry({
              component: 'chat.rpc',
              correlationId,
              event: 'chat_rpc_invalid_payload',
              level: 'error',
              queueName: this.queue,
              repoId: segments.repoId,
              runtimeFamily: 'pipeline',
              service: 'web-api',
              status: 'error'
            })
            return reject(new Error('Invalid response payload'))
          }
          emitTelemetry({
            component: 'chat.rpc',
            correlationId,
            durationMs: Date.now() - startedAt,
            event: 'chat_rpc_response_received',
            level: 'info',
            queueName: this.queue,
            repoId: segments.repoId,
            runtimeFamily: 'pipeline',
            service: 'web-api',
            status: 'ok'
          })
          resolve(answer)
        } catch (e) {
          this.channel.cancel(consumerTag).catch(() => {})

          if (timer) {
            clearTimeout(timer)
          }

          emitTelemetry({
            component: 'chat.rpc',
            correlationId,
            event: 'chat_rpc_response_parse_failed',
            level: 'error',
            queueName: this.queue,
            repoId: segments.repoId,
            runtimeFamily: 'pipeline',
            service: 'web-api',
            status: 'error'
          })
          reject(e)
        }
      }

      const { consumerTag } = await this.channel.consume(replyTo, onMessage, { noAck: false })

      timer = setTimeout(() => {
        this.channel.cancel(consumerTag).catch(() => {})
        emitTelemetry({
          component: 'chat.rpc',
          correlationId,
          durationMs: Date.now() - startedAt,
          event: 'chat_rpc_timeout',
          level: 'error',
          queueName: this.queue,
          repoId: segments.repoId,
          runtimeFamily: 'pipeline',
          service: 'web-api',
          status: 'timeout'
        })
        reject(new Error('RPC timeout'))
      }, timeoutMs)

      this.channel.sendToQueue(
        this.queue,
        Buffer.from(JSON.stringify(segments)),
        {
          contentType: 'application/json',
          correlationId,
          persistent: true,
          replyTo
        }
      )
      emitTelemetry({
        component: 'chat.rpc',
        correlationId,
        event: 'chat_rpc_request_published',
        level: 'info',
        queueName: this.queue,
        repoId: segments.repoId,
        runtimeFamily: 'pipeline',
        service: 'web-api',
        status: 'ok'
      })
    })
  }
}
