import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { firstValueFrom } from 'rxjs'
import { Repository } from 'typeorm'

import { summarizeSegments } from '../../utils/helpers'
import { Embedding } from '../embedding/entities/embedding.entity'

@Injectable()
export class DocsService {
  constructor(
    @InjectRepository(Embedding) private embeddingRepo: Repository<Embedding>,
    private readonly httpService: HttpService
  ) { }

  private logger: Logger = new Logger(DocsService.name)

  async generateDocumentation(repoId: number): Promise<string> {
    const matches = await this.embeddingRepo
      .createQueryBuilder('e')
      .innerJoin('e.file', 'file')
      .where('file.repo_id = :repoId', { repoId })
      .andWhere('e.symbolKind IN (:...kinds)', {
        kinds: ['function', 'class', 'file'],
      })
      .limit(2000)
      .getMany()

    const safeContext = summarizeSegments(matches, 200000)

    const response = await firstValueFrom(
      this.httpService.post<string>('http://localhost:8000/docs', {
        prompt: 'Wygeneruj dokumentację',
        context: safeContext,
      })
    )

    return response.data
  }
}
