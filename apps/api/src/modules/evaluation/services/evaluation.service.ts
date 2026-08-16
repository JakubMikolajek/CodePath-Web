import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common'
import type { RepoEvaluationJobRequest } from '@workspace/codepath-common/repository'
import { and, desc, eq, sql } from 'drizzle-orm'

import { assertRepoOwnership } from '../../../utils/helpers'
import { evaluationMetrics, evaluationRuns } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { OrchestratorClient } from '../../orchestrator-client/services/orchestrator-client.service'

// TODO: move ot evaluation utils
const DEFAULT_RUN_LIMIT = 50
const MAX_RUN_LIMIT = 200
const SUPPORTED_RUN_TYPES = ['docs_quality', 'retrieval', 'chat_faithfulness', 'full'] as const

type EvaluationRunType = typeof SUPPORTED_RUN_TYPES[number]

@Injectable()
export class EvaluationService {
  constructor(
    private readonly dbService: DbService,
    private readonly orchestratorClient: OrchestratorClient
  ) { }

  async getRunMetrics(userId: number, repoId: number, runId: number) {
    await assertRepoOwnership(this.dbService, userId, repoId)
    await this.assertRunBelongsToRepo(repoId, runId)

    return await this.dbService.dbClient.select({
      createdAt: evaluationMetrics.createdAt,
      id: evaluationMetrics.id,
      metricName: evaluationMetrics.metricName,
      metricValue: evaluationMetrics.metricValue,
      runId: evaluationMetrics.runId,
      targetRef: evaluationMetrics.targetRef
    }).from(evaluationMetrics).where(
      eq(evaluationMetrics.runId, runId)
    ).orderBy(evaluationMetrics.createdAt, evaluationMetrics.id)
  }

  async getTrend(userId: number, repoId: number) {
    await assertRepoOwnership(this.dbService, userId, repoId)

    return await this.dbService.dbClient.select({
      averageMetricValue: sql<number>`avg(${evaluationMetrics.metricValue})::float8`,
      firstMetricAt: sql<Nullable<number>>`min(${evaluationMetrics.createdAt})`,
      lastMetricAt: sql<Nullable<string>>`max(${evaluationMetrics.createdAt})`,
      metricName: evaluationMetrics.metricName,
      sampleCount: sql<number>`count(*)::int`
    }).from(evaluationMetrics).innerJoin(
      evaluationRuns,
      eq(evaluationMetrics.runId, evaluationRuns.id)
    ).where(
      eq(evaluationRuns.repoId, repoId)
    ).groupBy(evaluationMetrics.metricName).orderBy(evaluationMetrics.metricName)
  }

  async listRuns(userId: number, repoId: number, rawLimit?: string) {
    await assertRepoOwnership(this.dbService, userId, repoId)

    const limit = this.parseLimit(rawLimit)

    return await this.dbService.dbClient.select({
      completedAt: evaluationRuns.completedAt,
      errorMessage: evaluationRuns.errorMessage,
      id: evaluationRuns.id,
      repoId: evaluationRuns.repoId,
      runType: evaluationRuns.runType,
      status: evaluationRuns.status,
      triggeredAt: evaluationRuns.triggeredAt
    }).from(evaluationRuns).where(
      eq(evaluationRuns.repoId, repoId)
    ).orderBy(
      desc(evaluationRuns.triggeredAt),
      desc(evaluationRuns.id)
    ).limit(limit)
  }

  async triggerEvaluation(userId: number, repoId: number, rawRunType: unknown) {
    await assertRepoOwnership(this.dbService, userId, repoId)

    const runType = this.parseRunType(rawRunType)
    const job: RepoEvaluationJobRequest = { repoId, runType }

    try {
      await this.orchestratorClient.enqueueEvaluationJob(job)
    } catch {
      // TODO: ADD CUSTOM ERROR HANDLING WITH CODE AND STATUS FROM ENUM
      throw new ServiceUnavailableException('Evaluation job could not be enqueued')
    }

    return { message: 'Evaluation job enqueued', status: 'queued' }
  }

  private async assertRunBelongsToRepo(repoId: number, runId: number) {
    const [run] = await this.dbService.dbClient.select({
      id: evaluationRuns.id
    }).from(evaluationRuns).where(
      and(
        eq(evaluationRuns.id, runId),
        eq(evaluationRuns.repoId, repoId)
      )
    ).limit(1)

    // TODO: ADD CUSTOM ERROR HANDLING WITH CODE AND STATUS FROM ENUM
    if (!run) throw new NotFoundException('Evaluation run not found')
  }

  private parseLimit(value?: string): number {
    const rawValue = value?.trim()

    if (!rawValue) return DEFAULT_RUN_LIMIT

    const parsed = Number(rawValue)

    // TODO: ADD CUSTOM ERROR HANDLING WITH CODE AND STATUS FROM ENUM
    if (!Number.isInteger(parsed) || parsed < 1) throw new BadRequestException('limit must be a positive integer')

    return Math.min(parsed, MAX_RUN_LIMIT)
  }

  private parseRunType(value: unknown): EvaluationRunType {
    // TODO: ADD CUSTOM ERROR HANDLING WITH CODE AND STATUS FROM ENUM
    if (typeof value !== 'string') throw new BadRequestException('runType is required')

    const runType = value.trim()

    // TODO: ADD CUSTOM ERROR HANDLING WITH CODE AND STATUS FROM ENUM
    if (!SUPPORTED_RUN_TYPES.includes(runType as EvaluationRunType)) throw new BadRequestException(`runType must be one of: ${SUPPORTED_RUN_TYPES.join(', ')}`)

    return runType as EvaluationRunType
  }
}
