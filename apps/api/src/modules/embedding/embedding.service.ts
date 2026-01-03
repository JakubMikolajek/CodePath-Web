import * as fs from 'node:fs'
import * as path from 'node:path'

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import * as amqp from 'amqplib'
import { eq } from 'drizzle-orm'
import { promises as fsp } from 'fs'
import { slice } from 'lodash'

import { buildMermaidGraph } from '../../utils/mermaidBuilder'
import { parseSegments } from '../../utils/parser'
import { DbService } from '../db/db.service'
import { dependencies, files, repos, SelectRepo } from '../db/schema'

@Injectable()
export class EmbeddingService {
  private channel: amqp.Channel
  private conn: amqp.ChannelModel
  private readonly logger: Logger = new Logger(EmbeddingService.name)
  private readonly queue = 'embedding'

  constructor(
    private readonly dbService: DbService
  ) { }

  async embedRepo(repo: SelectRepo) {
    const BATCH = 64

    const allFiles = await this.dbService.dbClient.select()
      .from(files)
      .where(eq(files.repoId, repo.id))

    for (const file of allFiles) {
      const abs = path.join(repo.path ?? '', file.path ?? '')

      if (!fs.existsSync(abs)) {
        continue
      }

      const src = await fsp.readFile(abs, 'utf8')
      const { parsedDependencies, parsedSegments } = parseSegments(src, path.extname(file.path), file.path)

      const graph = buildMermaidGraph(parsedDependencies)

      if (graph) {
        await this.dbService.dbClient.insert(dependencies).values({
          fileId: file.id,
          fileName: path.basename(file.path),
          graph,
          repoId: repo.id
        })
      }

      for (let i = 0; i < parsedSegments.length; i += BATCH) {
        const batch = slice(parsedSegments, i, i + BATCH)

        const batchPayload = batch.map(s => ({
          comment: s.comment,
          content: s.code,
          decorators: s.decorators,
          endLine: s.endLine,
          fileId: file.id,
          filePath: file.path,
          jsDoc: s.jsDoc,
          params: s.params,
          returnType: s.returnType,
          startLine: s.startLine,
          symbolKind: s.kind,
          symbolName: s.name
        }))

        this.publishEmbeddingsJob(batchPayload, repo.id)
      }
    }

    await this.dbService.dbClient.update(repos).set({
      embeddingStatus: 'embeded'
    }).where(eq(repos.id, repo.id))

    return { message: `Embeddings queued for repo ${repo.id}` }
  }

  async onModuleDestroy() {
    await this.channel?.close()
    await this.conn?.close()
  }

  async onModuleInit() {
    this.conn = await amqp.connect('amqp://admin:admin@127.0.0.1')
    this.channel = await this.conn.createChannel()
    await this.channel.assertQueue(this.queue, { durable: true })
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async poolFromPending() {
    const [repoToEmbedding] = await this.dbService.dbClient.select()
      .from(repos)
      .where(eq(repos.embeddingStatus, 'pending'))
      .limit(1)

    if (!repoToEmbedding) {
      return
    }

    await this.embedRepo(repoToEmbedding)
  }

  publishEmbeddingsJob(segments: {
    comment?: string
    content: string
    decorators?: string[]
    endLine?: number
    fileId: number
    filePath?: string
    jsDoc?: string
    params?: string[]
    returnType?: string
    startLine?: number
    symbolKind: string
    symbolName?: string
  }[], repoId: number): void {
    this.channel.sendToQueue(
      this.queue,
      Buffer.from(
        JSON.stringify({ repoId, segments })
      ), { persistent: true }
    )
  }
}
