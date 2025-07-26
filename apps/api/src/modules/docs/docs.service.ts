import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import { eq, inArray, and } from 'drizzle-orm'
import { firstValueFrom } from 'rxjs'

import { summarizeSegments } from '../../utils/helpers'
import { DbService } from '../db/db.service'
import { embeddings, files } from '../db/schema'

@Injectable()
export class DocsService {
  constructor(
    private readonly httpService: HttpService,
    private readonly dbService: DbService
  ) { }

  private logger: Logger = new Logger(DocsService.name)

  async generateDocumentation(repoId: number): Promise<string> {
    const LIMIT = 2000

    const kinds = ['function', 'class', 'file']

    const matches = await this.dbService.dbClient.select()
      .from(embeddings)
      .innerJoin(files, eq(embeddings.fileId, files.id))
      .where(
        and(
          eq(files.repoId, repoId),
          inArray(embeddings.symbolKind, kinds)
        )
      )
      .limit(LIMIT)

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
