import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'

import { enqueueDocsJob } from '../../lib/orchestrator-client'
import { emitTelemetry } from '../../lib/telemetry'
import { DbService } from '../db/db.service'
import { repos } from '../db/schema'

@Injectable()
export class DocsService {
  constructor(
    private readonly dbService: DbService
  ) { }

  async generateDocumentation(userId: number, repoId: number) {
    const repo = await this.assertRepoOwnership(userId, repoId)

    if (repo.embeddingStatus !== 'embedded') {
      throw new ConflictException('Embeddings are not ready for documentation generation')
    }

    try {
      await enqueueDocsJob({ repoId })
      emitTelemetry({
        component: 'docs.service',
        event: 'docs_job_published',
        level: 'info',
        queueName: 'docs',
        repoId,
        runtimeFamily: 'pipeline',
        service: 'web-api',
        status: 'ok'
      })
    } catch (cause) {
      emitTelemetry({
        component: 'docs.service',
        details: {
          errorMessage: cause instanceof Error ? cause.message : String(cause),
          errorName: cause instanceof Error ? cause.name : 'UnknownError'
        },
        event: 'docs_job_publish_failed',
        level: 'error',
        queueName: 'docs',
        repoId,
        runtimeFamily: 'pipeline',
        service: 'web-api',
        status: 'error'
      })
      throw cause
    }

    return { message: 'Documentation generation started' }
  }

  async getDocumentation(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

    const [repo] = await this.dbService.dbClient.select()
      .from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    return repo?.documentation
  }

  private async assertRepoOwnership(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select({
      embeddingStatus: repos.embeddingStatus,
      id: repos.id
    })
      .from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) {
      throw new NotFoundException('Repository not found')
    }

    return repo
  }
}
