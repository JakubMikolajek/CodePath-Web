import { describe, expect, it } from 'vitest'

import type { EvaluationMetric, EvaluationRun, EvaluationTrendPoint } from '@/lib/evaluations'

import evaluationReducer, {
  getEvaluationRunMetrics,
  getEvaluationRuns,
  getEvaluationTrend,
  triggerEvaluation
} from './evaluationSlice'

describe('evaluationSlice', () => {
  const runFixture: EvaluationRun = {
    completedAt: '2026-07-03 12:05:00',
    errorMessage: null,
    id: 11,
    repoId: 7,
    runType: 'docs_quality',
    status: 'completed',
    triggeredAt: '2026-07-03 12:00:00'
  }

  const metricFixture: EvaluationMetric = {
    createdAt: '2026-07-03 12:04:00',
    id: 31,
    metricName: 'rouge_l',
    metricValue: 0.82,
    runId: 11,
    targetRef: 'README.md'
  }

  const trendFixture: EvaluationTrendPoint = {
    averageMetricValue: 0.73,
    firstMetricAt: '2026-07-03 12:04:00',
    lastMetricAt: '2026-07-03 12:04:00',
    metricName: 'rouge_l',
    sampleCount: 1
  }

  it('tracks run list loading, success and empty states', () => {
    const loadingState = evaluationReducer(undefined, getEvaluationRuns.pending('req-1', { repoId: 7 }))
    const successState = evaluationReducer(loadingState, getEvaluationRuns.fulfilled([runFixture], 'req-2', { repoId: 7 }))
    const emptyState = evaluationReducer(successState, getEvaluationRuns.fulfilled([], 'req-3', { repoId: 7 }))

    expect(loadingState.runsStatus).toBe('loading')
    expect(successState.runsStatus).toBe('success')
    expect(successState.runs).toEqual([runFixture])
    expect(emptyState.runsStatus).toBe('empty')
  })

  it('stores trend rows and exposes explicit empty state', () => {
    const successState = evaluationReducer(undefined, getEvaluationTrend.fulfilled([trendFixture], 'req-1', 7))
    const emptyState = evaluationReducer(successState, getEvaluationTrend.fulfilled([], 'req-2', 7))

    expect(successState.trendStatus).toBe('success')
    expect(successState.trend).toEqual([trendFixture])
    expect(emptyState.trendStatus).toBe('empty')
  })

  it('stores selected run metrics for the requested run', () => {
    const loadingState = evaluationReducer(undefined, getEvaluationRunMetrics.pending('req-1', { repoId: 7, runId: 11 }))
    const successState = evaluationReducer(loadingState, getEvaluationRunMetrics.fulfilled([metricFixture], 'req-2', { repoId: 7, runId: 11 }))

    expect(loadingState.selectedRunId).toBe(11)
    expect(loadingState.metricsStatus).toBe('loading')
    expect(successState.metricsStatus).toBe('success')
    expect(successState.metrics).toEqual([metricFixture])
  })

  it('tracks trigger success and rejected errors', () => {
    const successState = evaluationReducer(
      undefined,
      triggerEvaluation.fulfilled({ message: 'Evaluation job enqueued', status: 'queued' }, 'req-1', { repoId: 7, runType: 'docs_quality' })
    )
    const errorState = evaluationReducer(successState, triggerEvaluation.rejected(new Error('boom'), 'req-2', { repoId: 7, runType: 'full' }, 'Cannot trigger evaluation run'))

    expect(successState.triggerStatus).toBe('success')
    expect(successState.triggerMessage).toBe('Evaluation job enqueued')
    expect(errorState.triggerStatus).toBe('error')
    expect(errorState.triggerError).toBe('Cannot trigger evaluation run')
  })
})
