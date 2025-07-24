import { promises as fsp } from 'fs'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import * as amqp from 'amqplib'
import { eq, sql } from 'drizzle-orm'
import { slice } from 'lodash'
import { firstValueFrom } from 'rxjs'

import { buildMermaidGraph } from '../../utils/mermaidBuilder'
import { parseSegments } from '../../utils/parser'
import { DbService } from '../db/db.service'
import { dependencies, embeddings, files, repos } from '../db/schema'

@Injectable()
export class EmbeddingService {
  private conn: amqp.ChannelModel
  private channel: amqp.Channel
  private readonly queue = 'embedding'

  constructor(
    private readonly httpService: HttpService,
    private readonly dbService: DbService
  ) { }

  async onModuleInit() {
    this.conn = await amqp.connect('amqp://admin:admin@192.168.1.245')
    this.channel = await this.conn.createChannel()
    await this.channel.assertQueue(this.queue, { durable: true })
  }

  async onModuleDestroy() {
    await this.channel?.close()
    await this.conn?.close()
  }

  publishEmbeddingsJob(segments: {
    fileId: number
    symbolKind: string
    symbolName?: string
    content: string
  }[]): void {
    this.channel.sendToQueue(
      this.queue,
      Buffer.from(
        JSON.stringify({ segments })
      ), { persistent: true }
    )
  }

  async embedRepo(repoId: number) {
    const BATCH = 64

    const allFiles = await this.dbService.dbClient.select()
      .from(files)
      .innerJoin(repos, eq(files.repoId, repos.id))
      .where(eq(files.repoId, repoId))

    for (const file of allFiles) {
      const abs = path.join(file.repos.path ?? '', file.files.path ?? '')

      if (!fs.existsSync(abs)) {
        continue
      }

      const src = await fsp.readFile(abs, 'utf8')
      const { parsedSegments, parsedDependencies } = parseSegments(src, path.extname(file.files.path), file.files.path)

      const graph = buildMermaidGraph(parsedDependencies)

      if (graph) {
        await this.dbService.dbClient.insert(dependencies).values({
          repoId,
          fileId: file.files.id,
          fileName: path.basename(file.files.path),
          graph,
        })
      }

      for (let i = 0; i < parsedSegments.length; i += BATCH) {
        const batch = slice(parsedSegments, i, i + BATCH)

        const batchPayload = batch.map(s => ({
          fileId: file.files.id,
          symbolKind: s.kind,
          symbolName: s.name,
          content: s.code,
        }))

        this.publishEmbeddingsJob(batchPayload)
      }
    }

    return { message: `Embeddings queued for repo ${repoId}` }
  }

  async shouldBeEmbedded(repoId: number) {
    const allFiles = await this.dbService.dbClient.select()
      .from(files)
      .innerJoin(repos, eq(repos.id, repoId))
      .where(eq(files.repoId, repoId))

    for (const file of allFiles) {
      const count = await this.dbService.dbClient
        .select({ count: sql<number>`count(*)` })
        .from(embeddings)
        .where(eq(embeddings.fileId, file.files.id))
        .then(rows => rows[0]?.count ?? 0)

      if (count > 0) {
        return false
      }
    }

    return true
  }

  async getEmbedding(text: string) {
    const response = await firstValueFrom(
      this.httpService.post<number[]>('http://localhost:8000/embed-question', { text }),
    )

    return response.data
  }
}
