import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { Client } from 'pg'

import { env } from '../../../config/env'
import { evaluationRuns, repos } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { RealtimeEventsService } from './realtime-events.service'

const REPO_CHANNEL = 'realtime_repo_changed'
const EVALUATION_RUN_CHANNEL = 'realtime_evaluation_run_changed'

interface RepoNotificationPayload {
  id: number
}

interface EvaluationRunNotificationPayload {
  id: number
  repoId: number
}

@Injectable()
export class RealtimeDbChangeListenerService implements OnModuleDestroy, OnModuleInit {
  private readonly client = new Client({ connectionString: env.databaseUrl })
  private readonly logger = new Logger(RealtimeDbChangeListenerService.name)

  constructor(
    private readonly dbService: DbService,
    private readonly realtimeEventsService: RealtimeEventsService
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.end()
  }

  async onModuleInit(): Promise<void> {
    this.client.on('notification', message => {
      void this.handleNotification(message.channel, message.payload).catch(error => {
        this.logger.error(`Could not handle realtime database notification: ${error instanceof Error ? error.message : 'unknown error'}`)
      })
    })

    this.client.on('error', error => this.logger.error(`Realtime database listener failed: ${error.message}`))

    await this.client.connect()
    await this.client.query(`LISTEN ${REPO_CHANNEL}`)
    await this.client.query(`LISTEN ${EVALUATION_RUN_CHANNEL}`)
    this.logger.log('Realtime database listener connected')
  }

  private async emitEvaluationRunUpdate(runId: number, repoId: number): Promise<void> {
    const [run] = await this.dbService.dbClient.select({
      completedAt: evaluationRuns.completedAt,
      errorMessage: evaluationRuns.errorMessage,
      id: evaluationRuns.id,
      repoId: evaluationRuns.repoId,
      runType: evaluationRuns.runType,
      status: evaluationRuns.status,
      triggeredAt: evaluationRuns.triggeredAt,
      userId: repos.userId
    }).from(evaluationRuns).innerJoin(repos, eq(evaluationRuns.repoId, repos.id)).where(
      and(
        eq(evaluationRuns.id, runId),
        eq(evaluationRuns.repoId, repoId)
      )
    ).limit(1)

    if (!run) return

    this.realtimeEventsService.emitEvaluationRunUpdated(run.userId, run)
  }

  private async emitRepoUpdate(repoId: number): Promise<void> {
    const [repo] = await this.dbService.dbClient.select({
      cloneStatus: repos.cloneStatus,
      docsStatus: repos.docsStatus,
      embeddingStatus: repos.embeddingStatus,
      id: repos.id,
      lastPipelineError: repos.lastPipelineError,
      pipelineUpdatedAt: repos.pipelineUpdatedAt,
      userId: repos.userId
    }).from(repos).where(eq(repos.id, repoId)).limit(1)

    if (!repo) return

    this.realtimeEventsService.emitRepoPipelineUpdated(repo.userId, repo)
  }

  private async handleNotification(channel: string, rawPayload: string | undefined): Promise<void> {
    if (!rawPayload) return

    if (channel === REPO_CHANNEL) {
      const payload = this.parsePayload<RepoNotificationPayload>(rawPayload)

      if (payload) await this.emitRepoUpdate(payload.id)

      return
    }

    if (channel === EVALUATION_RUN_CHANNEL) {
      const payload = this.parsePayload<EvaluationRunNotificationPayload>(rawPayload)

      if (payload) await this.emitEvaluationRunUpdate(payload.id, payload.repoId)
    }
  }

  private parsePayload<T>(rawPayload: string): null | T {
    try {
      const payload = JSON.parse(rawPayload) as T
      return payload
    } catch {
      this.logger.warn(`Ignoring invalid realtime database notification payload: ${rawPayload}`)
      return null
    }
  }
}
