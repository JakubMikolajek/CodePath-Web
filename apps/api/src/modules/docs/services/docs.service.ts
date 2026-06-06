import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import {
  TelemetryLevel,
  TelemetryRuntimeFamily,
  TelemetryService,
  TelemetryStatus
} from '@workspace/codepath-common/telemetry'
import { and, eq, ne } from 'drizzle-orm'

import { repos } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { OrchestratorClient } from '../../orchestrator-client/services/orchestrator-client.service'
import { emitTelemetry } from '../../telemetry/services/telemetry'

const nowIso = () => new Date().toISOString()

@Injectable()
export class DocsService {
  constructor(
    private readonly dbService: DbService,
    private readonly orchestratorClient: OrchestratorClient
  ) { }

  async generateDocumentation(userId: number, repoId: number) {
    const repo = await this.assertRepoOwnership(userId, repoId)

    if (repo.cloneStatus !== 'cloned') throw new ConflictException(`Repository clone is not ready for documentation generation (cloneStatus=${repo.cloneStatus})`)

    if (repo.embeddingStatus !== 'embedded') {
      emitTelemetry({
        component: 'docs.service',
        details: { embeddingStatus: repo.embeddingStatus },
        event: 'docs_job_blocked_embedding_not_ready',
        level: TelemetryLevel.WARN,
        repoId: repoId,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.ERROR
      })

      throw new ConflictException(this.embeddingStatusGateMessage(repo.embeddingStatus))
    }

    if (repo.docsStatus === 'processing') return { message: 'Documentation generation already in progress', status: 'processing' }

    const [claimedRepo] = await this.dbService.dbClient.update(repos).set({
      docsStatus: 'processing',
      documentation: null,
      lastPipelineError: null,
      pipelineUpdatedAt: nowIso()
    }).where(and(
      eq(repos.id, repoId),
      eq(repos.userId, userId),
      ne(repos.docsStatus, 'processing')
    )).returning({ id: repos.id })

    if (!claimedRepo) return { message: 'Documentation generation already in progress', status: 'processing' }

    try {
      await this.orchestratorClient.enqueueDocsJob({ repoId })
      emitTelemetry({
        component: 'docs.service',
        event: 'docs_job_published',
        level: TelemetryLevel.INFO,
        queueName: 'docs',
        repoId,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.OK
      })
    } catch (cause) {
      await this.dbService.dbClient.update(repos).set({
        docsStatus: 'failed',
        lastPipelineError: cause instanceof Error ? cause.message : String(cause),
        pipelineUpdatedAt: nowIso()
      }).where(and(eq(repos.id, repoId), eq(repos.userId, userId)))

      emitTelemetry({
        component: 'docs.service',
        details: {
          errorMessage: cause instanceof Error ? cause.message : String(cause),
          errorName: cause instanceof Error ? cause.name : 'UnknownError'
        },
        event: 'docs_job_publish_failed',
        level: TelemetryLevel.ERROR,
        queueName: 'docs',
        repoId,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.ERROR
      })
      throw cause
    }

    return { message: 'Documentation generation started', status: 'processing' }
  }

  async getDocumentation(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

    const [repo] = await this.dbService.dbClient.select().from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    return repo?.documentation
  }

  async getDocumentationStatus(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsStatus: repos.docsStatus,
      embeddingStatus: repos.embeddingStatus,
      id: repos.id,
      lastPipelineError: repos.lastPipelineError,
      pipelineUpdatedAt: repos.pipelineUpdatedAt
    }).from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) throw new NotFoundException('Repository not found')

    return repo
  }

  private async assertRepoOwnership(userId: number, repoId: number) {
    const [repo] = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsStatus: repos.docsStatus,
      embeddingStatus: repos.embeddingStatus,
      id: repos.id
    }).from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) throw new NotFoundException('Repository not found')

    return repo
  }

  // FIXME add enum
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
