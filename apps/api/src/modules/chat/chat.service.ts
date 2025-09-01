import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import * as amqp from 'amqplib'
import { and, desc, eq } from 'drizzle-orm'
import { map } from 'lodash'
import { v4 as uuidv4 } from 'uuid'

import { DbService } from '../db/db.service'
import { chatHistory, chatSessions } from '../db/schema'
import { EmbeddingService } from '../embedding/embedding.service'

import { AskDto } from './dto/ask.dto'

@Injectable()
export class ChatService {
  private conn: amqp.ChannelModel
  private channel: amqp.Channel
  private readonly queue = 'chat'
  private logger: Logger = new Logger(ChatService.name)

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly httpService: HttpService,
    private readonly dbService: DbService
  ) { }

  async onModuleInit() {
    this.conn = await amqp.connect('amqp://admin:admin@192.168.1.245')
    this.channel = await this.conn.createChannel()
    await this.channel.assertQueue(this.queue, { durable: true })
  }

  async createSession(userId: number, repoId: number) {
    await this.dbService.dbClient.insert(chatSessions).values({
      id: uuidv4(),
      name: `Session for repo ${repoId}`,
      userId,
      repoId,
    })
  }

  async onModuleDestroy() {
    await this.channel?.close()
    await this.conn?.close()
  }

  private async publishChatJob(segments: {
    prompt: string
    repoId: number
  }): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const correlationId = uuidv4()
      const timeoutMs = 60_000

      const { queue: replyTo } = await this.channel.assertQueue('', {
        exclusive: true,
        autoDelete: true,
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
            return reject(new Error('Invalid response payload'))
          }
          resolve(answer)
        }
        catch (e) {
          this.channel.cancel(consumerTag).catch(() => {})

          if (timer) {
            clearTimeout(timer)
          }

          reject(e)
        }
      }

      const { consumerTag } = await this.channel.consume(replyTo, onMessage, { noAck: false })

      timer = setTimeout(() => {
        this.channel.cancel(consumerTag).catch(() => {})
        reject(new Error('RPC timeout'))
      }, timeoutMs)

      this.channel.sendToQueue(
        this.queue,
        Buffer.from(JSON.stringify(segments)),
        {
          persistent: true,
          replyTo,
          correlationId,
          contentType: 'application/json',
        }
      )
    })
  }

  async askAboutRepo(userId: number, repoId: number, body: AskDto) {
    const { question, sessionId } = body
    this.logger.log(`Repo: ${repoId}, Q: ${question}`)

    await this.dbService.dbClient.insert(chatHistory).values({
      userId,
      sessionId,
      role: 'user',
      content: question,
    })

    const answer = await this.publishChatJob({
      prompt: question,
      repoId,
    })

    await this.dbService.dbClient.insert(chatHistory).values({
      userId,
      sessionId,
      role: 'assistant',
      content: answer,
    })

    return answer
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
      sessionId: session.id,
      sessionName: session.name,
      createdAt: session.createdAt,
    }))
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
      id: detail.id,
      role: detail.role,
      content: detail.content,
    }))
  }
}
