import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import pgvector from 'pgvector'
import { firstValueFrom } from 'rxjs'
import { Repository } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'

import { EmbeddingService } from '../embedding/embedding.service'
import { Embedding } from '../embedding/entities/embedding.entity'

import { AskDto } from './dto/ask.dto'
import { ChatHistory } from './entities/chat-history.entity'
import { ChatSession } from './entities/chat-session.entity'

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Embedding) private embeddingRepo: Repository<Embedding>,
    @InjectRepository(ChatSession) private sessionRepo: Repository<ChatSession>,
    @InjectRepository(ChatHistory) private historyRepo: Repository<ChatHistory>,
    private readonly embeddingService: EmbeddingService,
    private readonly httpService: HttpService
  ) {}

  private logger: Logger = new Logger(ChatService.name)

  async createSession(userId: number, repoId: number) {
    await this.sessionRepo.save({
      id: uuidv4(),
      name: `Session for repo ${repoId}`,
      user_id: userId,
      repo_id: repoId,
    })
  }

  async askAboutRepo(userId: number, repoId: number, body: AskDto) {
    const sessionId = body.sessionId
    const question = body.question
    this.logger.log(`Repo: ${repoId}, Q: ${question}`)

    await this.historyRepo.save({
      user_id: userId,
      session_id: sessionId,
      role: 'user',
      content: question,
    })

    const questionVec = await this.embeddingService.getEmbedding(question)

    const LIMIT = 20

    const matches = await this.embeddingRepo
      .createQueryBuilder('e')
      .innerJoin('e.file', 'file')
      .where('file.repo_id = :repoId', { repoId })
      .andWhere('e.symbolKind IN (:...kinds)', {
        kinds: ['function', 'class', 'file'],
      })
      .orderBy('e.embedding <-> :embedding', 'ASC')
      .setParameters({ embedding: pgvector.toSql(questionVec) })
      .limit(LIMIT)
      .getMany()

    const context = matches.map(m => m.content)

    function cutContext(chunks: string[], maxChars = 16000) {
      const out: string[] = []
      let used = 0
      for (const txt of chunks) {
        if (used + txt.length > maxChars) break
        out.push(txt)
        used += txt.length
      }
      return out
    }

    const safeContext = cutContext(context)

    const response = await firstValueFrom(
      this.httpService.post<string>('http://localhost:8000/chat', {
        prompt: question,
        context: safeContext,
      })
    )

    const answer = response.data

    await this.historyRepo.save({
      user_id: userId,
      session_id: sessionId,
      role: 'assistant',
      content: answer,
    })

    return answer
  }

  async getRepoChats(userId: number, repoId: number) {
    const sessions = await this.sessionRepo.find({
      where: { user_id: userId, repo_id: repoId },
      order: { created_at: 'DESC' },
    })

    return sessions.map(s => ({
      sessionId: s.id,
      sessionName: s.name,
      createdAt: s.created_at,
    }))
  }

  async getChatSessionDetails(userId: number, sessionId: string) {
    const sessionDetails = await this.historyRepo.find({
      where: { user_id: userId, session_id: sessionId },
      order: { created_at: 'ASC' },
    })

    return sessionDetails.map(detail => ({
      id: detail.id,
      role: detail.role,
      content: detail.content,
    }))
  }
}
