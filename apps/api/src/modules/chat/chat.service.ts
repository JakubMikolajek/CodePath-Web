import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import pgvector from 'pgvector'
import { firstValueFrom } from 'rxjs'
import { Repository } from 'typeorm'

import { EmbeddingService } from '../embedding/embedding.service'
import { Embedding } from '../embedding/entities/embedding.entity'

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Embedding) private embeddingRepo: Repository<Embedding>,
    private readonly embeddingService: EmbeddingService,
    private readonly httpService: HttpService
  ) {}

  private logger: Logger = new Logger(ChatService.name)

  async askAboutRepo(repoId: number, question: string) {
    this.logger.log(repoId, question)
    const questionVec = await this.embeddingService.getEmbedding(question)

    const matches = await this.embeddingRepo
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.file', 'file')
      .where('file.repo_id = :repoId', { repoId })
      .orderBy('e.embedding <-> :embedding', 'ASC')
      .setParameters({ embedding: pgvector.toSql(questionVec) })
      .getMany()

    const context = matches.map(m => m.content)

    this.logger.log(context)

    const response = await firstValueFrom(
      this.httpService.post('http://localhost:8000/chat', {
        prompt: question,
        context,
      })
    )

    return response.data
  }
}
