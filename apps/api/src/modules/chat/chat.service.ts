import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { map } from 'lodash'
import pgvector from 'pgvector'
import { firstValueFrom } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'

import { cutContext } from '../../utils/helpers'
import { DbService } from '../db/db.service'
import { chatHistory, chatSessions, embeddings, files } from '../db/schema'
import { EmbeddingService } from '../embedding/embedding.service'

import { AskDto } from './dto/ask.dto'

@Injectable()
export class ChatService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly httpService: HttpService,
    private readonly dbService: DbService
  ) { }

  private logger: Logger = new Logger(ChatService.name)

  async createSession(userId: number, repoId: number) {
    await this.dbService.dbClient.insert(chatSessions).values({
      id: uuidv4(),
      name: `Session for repo ${repoId}`,
      userId,
      repoId,
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

    const questionVec = await this.embeddingService.getEmbedding(question)

    const LIMIT = 20

    const kinds = ['function', 'class', 'file']

    const matches = await this.dbService.dbClient.select()
      .from(embeddings)
      .innerJoin(files, eq(embeddings.fileId, files.id))
      .where(inArray(embeddings.symbolKind, kinds))
      .orderBy(sql`embedding <=> ${pgvector.toSql(questionVec)}`)
      .limit(LIMIT)

    const context = map(matches, match => match.embeddings.content)

    const safeContext = cutContext(context)

    const response = await firstValueFrom(
      this.httpService.post<string>('http://localhost:8000/chat', {
        prompt: question,
        context: safeContext,
      })
    )

    const answer = response.data

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
