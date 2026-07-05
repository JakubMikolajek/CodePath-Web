import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common'

import { EvaluationService } from './services/evaluation.service'

type QueryKind = 'groupOrder' | 'limit' | 'order' | 'orderLimit'

interface QueryDescriptor {
  kind: QueryKind
  result: unknown[]
}

function createDbServiceMock(queries: QueryDescriptor[]) {
  const selectMock = jest.fn(() => {
    const descriptor = queries.shift()
    if (!descriptor) throw new Error('Unexpected select query')

    const chain: Record<string, jest.Mock> = {
      from: jest.fn(() => chain),
      groupBy: jest.fn(() => chain),
      innerJoin: jest.fn(() => chain),
      limit: jest.fn(() => Promise.resolve(descriptor.result)),
      orderBy: jest.fn(() => {
        if (descriptor.kind === 'orderLimit') {
          return {
            limit: jest.fn(() => Promise.resolve(descriptor.result))
          }
        }

        return Promise.resolve(descriptor.result)
      }),
      where: jest.fn(() => chain)
    }

    if (descriptor.kind === 'groupOrder') {
      chain.groupBy = jest.fn(() => ({
        orderBy: jest.fn(() => Promise.resolve(descriptor.result))
      }))
    }

    return chain
  })

  return {
    dbService: {
      dbClient: {
        select: selectMock
      }
    },
    selectMock
  }
}

describe('EvaluationService', () => {
  const orchestratorClient = {
    enqueueEvaluationJob: jest.fn()
  }

  beforeEach(() => {
    jest.restoreAllMocks()
    orchestratorClient.enqueueEvaluationJob.mockReset()
  })

  it('lists evaluation runs newest-first with the default bounded limit', async () => {
    const runs = [{
      completedAt: null,
      errorMessage: null,
      id: 11,
      repoId: 3,
      runType: 'docs_quality',
      status: 'completed',
      triggeredAt: '2026-07-03T09:00:00.000Z'
    }]
    const { dbService } = createDbServiceMock([
      { kind: 'limit', result: [{ id: 3, name: 'repo' }] },
      { kind: 'orderLimit', result: runs }
    ])
    const service = new EvaluationService(dbService as never, orchestratorClient as never)

    await expect(service.listRuns(1, 3)).resolves.toEqual(runs)
  })

  it('rejects invalid run limits', async () => {
    const { dbService } = createDbServiceMock([
      { kind: 'limit', result: [{ id: 3, name: 'repo' }] }
    ])
    const service = new EvaluationService(dbService as never, orchestratorClient as never)

    await expect(service.listRuns(1, 3, '0')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('returns metrics only after the run belongs to the requested repository', async () => {
    const metrics = [{
      createdAt: '2026-07-03T09:01:00.000Z',
      id: 21,
      metricName: 'bleu4',
      metricValue: 0.42,
      runId: 11,
      targetRef: null
    }]
    const { dbService } = createDbServiceMock([
      { kind: 'limit', result: [{ id: 3, name: 'repo' }] },
      { kind: 'limit', result: [{ id: 11 }] },
      { kind: 'order', result: metrics }
    ])
    const service = new EvaluationService(dbService as never, orchestratorClient as never)

    await expect(service.getRunMetrics(1, 3, 11)).resolves.toEqual(metrics)
  })

  it('hides metrics when the run does not belong to the requested repository', async () => {
    const { dbService } = createDbServiceMock([
      { kind: 'limit', result: [{ id: 3, name: 'repo' }] },
      { kind: 'limit', result: [] }
    ])
    const service = new EvaluationService(dbService as never, orchestratorClient as never)

    await expect(service.getRunMetrics(1, 3, 99)).rejects.toBeInstanceOf(NotFoundException)
  })

  it('returns generic SQL-aggregated metric trends', async () => {
    const trends = [{
      averageMetricValue: 0.74,
      firstMetricAt: '2026-07-03T09:01:00.000Z',
      lastMetricAt: '2026-07-03T09:03:00.000Z',
      metricName: 'custom_metric',
      sampleCount: 4
    }]
    const { dbService } = createDbServiceMock([
      { kind: 'limit', result: [{ id: 3, name: 'repo' }] },
      { kind: 'groupOrder', result: trends }
    ])
    const service = new EvaluationService(dbService as never, orchestratorClient as never)

    await expect(service.getTrend(1, 3)).resolves.toEqual(trends)
  })

  it('enqueues evaluation jobs through the orchestrator client', async () => {
    const { dbService } = createDbServiceMock([
      { kind: 'limit', result: [{ id: 3, name: 'repo' }] }
    ])
    const service = new EvaluationService(dbService as never, orchestratorClient as never)
    orchestratorClient.enqueueEvaluationJob.mockResolvedValue(undefined)

    await expect(service.triggerEvaluation(1, 3, 'docs_quality')).resolves.toEqual({
      message: 'Evaluation job enqueued',
      status: 'queued'
    })
    expect(orchestratorClient.enqueueEvaluationJob).toHaveBeenCalledWith({
      repoId: 3,
      runType: 'docs_quality'
    })
  })

  it('rejects unsupported evaluation run types', async () => {
    const { dbService } = createDbServiceMock([
      { kind: 'limit', result: [{ id: 3, name: 'repo' }] }
    ])
    const service = new EvaluationService(dbService as never, orchestratorClient as never)

    await expect(service.triggerEvaluation(1, 3, 'unknown')).rejects.toBeInstanceOf(BadRequestException)
    expect(orchestratorClient.enqueueEvaluationJob).not.toHaveBeenCalled()
  })

  it('maps orchestrator enqueue failures to an explicit service-unavailable error', async () => {
    const { dbService } = createDbServiceMock([
      { kind: 'limit', result: [{ id: 3, name: 'repo' }] }
    ])
    const service = new EvaluationService(dbService as never, orchestratorClient as never)
    orchestratorClient.enqueueEvaluationJob.mockRejectedValue(new Error('connect ECONNREFUSED'))

    await expect(service.triggerEvaluation(1, 3, 'docs_quality')).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
})
