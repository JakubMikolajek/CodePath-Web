import { Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import { enqueueDocsJob } from '../../lib/orchestrator-client'
import { emitTelemetry } from '../../lib/telemetry'
import { DbService } from '../db/db.service'
import { repos } from '../db/schema'
import { QdrantService } from '../qdrant/qdrant.service'

@Injectable()
export class DocsService {
  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService
  ) { }

  async generateDocumentation(repoId: number) {
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

  async getDocumentation(repoId: number) {
    const [repo] = await this.dbService.dbClient.select()
      .from(repos)
      .where(eq(repos.id, repoId))
      .limit(1)

    return repo?.documentation
  }
}
