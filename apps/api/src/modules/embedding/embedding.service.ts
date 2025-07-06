import * as fs from 'node:fs'
import * as path from 'node:path'

import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import pgvector from 'pgvector'
import { firstValueFrom } from 'rxjs'
import { Repository } from 'typeorm'

import { File } from '../repos/entities/file.entity'

import { Embedding } from './entities/embedding.entity'

@Injectable()
export class EmbeddingService {
  constructor(
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectRepository(Embedding) private embeddingRepo: Repository<Embedding>,
    private readonly httpService: HttpService
  ) {}

  async embedRepo(repoId: number) {
    const files = await this.fileRepo.find({
      where: { repoId },
      relations: ['repo'],
    })

    for (const file of files) {
      const absPath = path.join(file.repo.path, file.path)
      if (!fs.existsSync(absPath)) continue

      const content = fs.readFileSync(absPath, 'utf-8')
      const fragments = this.splitContent(content)

      for (const fragment of fragments) {
        if (!fragment.trim()) continue

        const vector = await this.getEmbedding(fragment)

        await this.embeddingRepo.save({
          fileId: file.id,
          type: 'line',
          content: fragment,
          embedding: pgvector.toSql(vector),
        })
      }
    }

    return { message: `Embedding generated for repo ${repoId}`, files }
  }

  async shouldBeEmbedded(repoId: number) {
    const files = await this.fileRepo.find({
      where: { repoId },
      relations: ['repo'],
    })

    for (const file of files) {
      const count = await this.embeddingRepo.count({
        where: { fileId: file.id },
      })

      if (count > 0) {
        return false
      }
    }

    return true
  }

  async getEmbedding(text: string) {
    const response = await firstValueFrom(
      this.httpService.post('http://localhost:8000/embedding', { text }),
    )

    return response.data
  }

  private splitContent(content: string): string[] {
    return content.split('\n').filter(line => line.trim().length > 0)
  }
}
