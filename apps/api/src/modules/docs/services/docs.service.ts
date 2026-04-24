import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq, ne } from 'drizzle-orm'

import { enqueueDocsJob } from '../../../lib/orchestrator-client'
import { emitTelemetry } from '../../../lib/telemetry'
import { repos } from '../../db/schema'
import { DbService } from '../../db/services/db.service'

@Injectable()
export class DocsService {
  constructor(
    private readonly dbService: DbService
  ) { }

  async generateDocumentation(userId: number, repoId: number) {
    const repo = await this.assertRepoOwnership(userId, repoId)

    if (repo.cloneStatus !== 'cloned') {
      throw new ConflictException(
        `Repository clone is not ready for documentation generation (cloneStatus=${repo.cloneStatus})`
      )
    }

    if (repo.embeddingStatus !== 'embedded') {
      emitTelemetry({
        component: 'docs.service',
        details: {
          embeddingStatus: repo.embeddingStatus
        },
        event: 'docs_job_blocked_embedding_not_ready',
        level: 'warn',
        repoId: repoId,
        runtimeFamily: 'pipeline',
        service: 'web-api',
        status: 'error'
      })
      throw new ConflictException(this.embeddingStatusGateMessage(repo.embeddingStatus))
    }

    if (repo.docsStatus === 'processing') {
      return {
        message: 'Documentation generation already in progress',
        status: 'processing' as const
      }
    }

    const [claimedRepo] = await this.dbService.dbClient.update(repos).set({
      docsStatus: 'processing',
      documentation: null
    })
      .where(and(
        eq(repos.id, repoId),
        eq(repos.userId, userId),
        ne(repos.docsStatus, 'processing')
      ))
      .returning({
        id: repos.id
      })

    if (!claimedRepo) {
      return {
        message: 'Documentation generation already in progress',
        status: 'processing' as const
      }
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
      await this.dbService.dbClient.update(repos).set({
        docsStatus: 'failed'
      }).where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
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

    return {
      message: 'Documentation generation started',
      status: 'processing' as const
    }
  }

  async getDocumentation(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

    const [repo] = await this.dbService.dbClient.select()
      .from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    return repo?.documentation
  }

  async getDocumentationStatus(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsStatus: repos.docsStatus,
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

  private async assertRepoOwnership(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsStatus: repos.docsStatus,
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

  private embeddingStatusGateMessage(status: 'embedded' | 'failed' | 'pending' | 'processing') {
    switch (status) {
      case 'failed':
        return 'Embeddings failed. Re-run embedding before generating documentation.'
      case 'pending':
        return 'Embeddings are pending. Start embedding before generating documentation.'
      case 'processing':
        return 'Embeddings are still processing. Wait for completion before generating documentation.'
      case 'embedded':
        return 'Embeddings are ready for documentation generation.'
    }
  }
}
