import * as fs from 'node:fs'
import * as path from 'node:path'

import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { eq } from 'drizzle-orm'
import { promises as fsp } from 'fs'
import { slice } from 'lodash'

import { enqueueEmbeddingJob } from '../../lib/orchestrator-client'
import { emitTelemetry } from '../../lib/telemetry'
import { buildMermaidGraph } from '../../utils/mermaidBuilder'
import { parseSegments, resolveCodeLanguageFromExt } from '../../utils/parser'
import { DbService } from '../db/db.service'
import { dependencies, files, repos, SelectRepo } from '../db/schema'

@Injectable()
export class EmbeddingService {
  private readonly logger: Logger = new Logger(EmbeddingService.name)

  constructor(
    private readonly dbService: DbService
  ) { }

  async embedRepo(repo: SelectRepo) {
    const BATCH = 64
    emitTelemetry({
      component: 'embedding.service',
      event: 'embedding_repo_processing_started',
      level: 'info',
      repoId: repo.id,
      runtimeFamily: 'pipeline',
      service: 'web-api',
      status: 'ok'
    })

    const allFiles = await this.dbService.dbClient.select()
      .from(files)
      .where(eq(files.repoId, repo.id))

    for (const file of allFiles) {
      const abs = path.join(repo.path ?? '', file.path ?? '')

      if (!fs.existsSync(abs)) {
        continue
      }

      const src = await fsp.readFile(abs, 'utf8')
      const fileExt = path.extname(file.path).toLowerCase()
      const language = resolveCodeLanguageFromExt(fileExt)
      const { parsedDependencies, parsedSegments } = parseSegments(src, fileExt, file.path)

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
          fileExt,
          fileId: file.id,
          filePath: file.path,
          jsDoc: s.jsDoc,
          language,
          params: s.params,
          repoId: repo.id,
          returnType: s.returnType,
          startLine: s.startLine,
          symbolKind: s.kind,
          symbolName: s.name
        }))

        await this.enqueueEmbeddingsJob(batchPayload, repo.id)
      }
    }

    await this.dbService.dbClient.update(repos).set({
      embeddingStatus: 'embeded'
    }).where(eq(repos.id, repo.id))
    emitTelemetry({
      component: 'embedding.service',
      event: 'embedding_repo_processing_finished',
      level: 'info',
      repoId: repo.id,
      runtimeFamily: 'pipeline',
      service: 'web-api',
      status: 'ok'
    })

    return { message: `Embeddings queued for repo ${repo.id}` }
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

  private async enqueueEmbeddingsJob(segments: {
    comment?: string
    content: string
    decorators?: string[]
    endLine?: number
    fileExt?: string
    fileId: number
    filePath?: string
    jsDoc?: string
    language?: string
    params?: string[]
    returnType?: string
    startLine?: number
    symbolKind: string
    symbolName?: string
  }[], repoId: number): Promise<void> {
    try {
      await enqueueEmbeddingJob({ repoId, segments })
      emitTelemetry({
        component: 'embedding.service',
        details: {
          segmentCount: segments.length
        },
        event: 'embedding_job_published',
        level: 'info',
        queueName: 'embedding',
        repoId,
        runtimeFamily: 'pipeline',
        service: 'web-api',
        status: 'ok'
      })
    } catch (cause) {
      emitTelemetry({
        component: 'embedding.service',
        details: {
          errorMessage: cause instanceof Error ? cause.message : String(cause),
          errorName: cause instanceof Error ? cause.name : 'UnknownError',
          segmentCount: segments.length
        },
        event: 'embedding_job_publish_failed',
        level: 'error',
        queueName: 'embedding',
        repoId,
        runtimeFamily: 'pipeline',
        service: 'web-api',
        status: 'error'
      })
      throw cause
    }
  }
}
