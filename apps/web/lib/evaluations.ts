import { apiClient } from '@/lib/api/api'

export const EVALUATION_RUN_TYPES = ['docs_quality', 'retrieval', 'chat_faithfulness', 'full'] as const

export type EvaluationRunType = typeof EVALUATION_RUN_TYPES[number]
export type EvaluationRunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface EvaluationRun {
  completedAt: string | null
  errorMessage: string | null
  id: number
  repoId: number
  runType: EvaluationRunType
  status: EvaluationRunStatus
  triggeredAt: string
}

export interface EvaluationMetric {
  createdAt: string
  id: number
  metricName: string
  metricValue: number
  runId: number
  targetRef: string | null
}

export interface EvaluationTrendPoint {
  averageMetricValue: number
  firstMetricAt: string | null
  lastMetricAt: string | null
  metricName: string
  sampleCount: number
}

export interface TriggerEvaluationResponse {
  message: string
  status: 'queued'
}

export async function getRepoEvaluationRuns(repoId: number, limit?: number) {
  return await apiClient.get<EvaluationRun[]>(`/evaluation/${repoId}/runs`, {
    params: { limit }
  })
}

export async function getRunMetrics(repoId: number, runId: number) {
  return await apiClient.get<EvaluationMetric[]>(`/evaluation/${repoId}/runs/${runId}/metrics`)
}

export async function getRepoEvaluationTrend(repoId: number) {
  return await apiClient.get<EvaluationTrendPoint[]>(`/evaluation/${repoId}/trend`)
}

export async function triggerEvaluationRun(repoId: number, runType: EvaluationRunType) {
  return await apiClient.post<TriggerEvaluationResponse, { runType: EvaluationRunType }>(`/evaluation/${repoId}/trigger`, { runType })
}
