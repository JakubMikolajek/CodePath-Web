import { promises as fsp } from 'fs'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import * as amqp from 'amqplib'
import { firstValueFrom } from 'rxjs'
import { Repository } from 'typeorm'

import { parseSegments } from '../../utils/parser'
import { File } from '../repos/entities/file.entity'

import { Embedding } from './entities/embedding.entity'

@Injectable()
export class EmbeddingService {
  private conn: amqp.ChannelModel
  private channel: amqp.Channel
  private readonly queue = 'embedding'

  constructor(
    @InjectRepository(File) private fileRepo: Repository<File>,
    @InjectRepository(Embedding) private embeddingRepo: Repository<Embedding>,
    private readonly httpService: HttpService
  ) {}

  async onModuleInit() {
    this.conn = await amqp.connect('amqp://admin:admin@192.168.1.245')
    this.channel = await this.conn.createChannel()
    await this.channel.assertQueue(this.queue, { durable: true })
  }

  async onModuleDestroy() {
    await this.channel?.close()
    await this.conn?.close()
  }

  async publishEmbeddingsJob(segments: {
    fileId: number
    symbolKind: string
    symbolName?: string
    content: string
  }[]): Promise<void> {
    this.channel.sendToQueue(
      this.queue,
      Buffer.from(
        JSON.stringify({ segments })
      ), { persistent: true }
    )
  }

  async embedRepo(repoId: number) {
    const BATCH = 64

    const files = await this.fileRepo.find({
      where: { repoId },
      relations: ['repo'],
    })

    for (const file of files) {
      const abs = path.join(file.repo.path, file.path)

      if (!fs.existsSync(abs)) {
        continue
      }

      const src = await fsp.readFile(abs, 'utf8')
      const segs = parseSegments(src, path.extname(file.path))

      for (let i = 0; i < segs.length; i += BATCH) {
        const batch = segs.slice(i, i + BATCH)

        const batchPayload = batch.map(s => ({
          fileId: file.id,
          symbolKind: s.kind,
          symbolName: s.name,
          content: s.code,
        }))

        await this.publishEmbeddingsJob(batchPayload)
      }
    }

    return { message: `Embeddings queued for repo ${repoId}` }
  }

  async shouldBeEmbedded(repoId: number) {
    const files = await this.fileRepo.find({
      where: { repoId },
      relations: ['repo'],
    })

    for (const file of files) {
      const count = await this.embeddingRepo.count({ where: { fileId: file.id } })

      if (count > 0) {
        return false
      }
    }

    return true
  }

  async getEmbedding(text: string) {
    const response = await firstValueFrom(
      this.httpService.post('http://localhost:8000/embed', { text }),
    )

    return response.data
  }
}
