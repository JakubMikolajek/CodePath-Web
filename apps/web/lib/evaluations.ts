import type { Nullable } from '@workspace/codepath-common'

//FIXME: maybe enum?
export const EVALUATION_RUN_TYPES = ['docs_quality', 'retrieval', 'chat_faithfulness', 'full'] as const

export type EvaluationRunType = typeof EVALUATION_RUN_TYPES[number]
export type EvaluationRunStatus = 'completed' | 'failed' | 'pending' | 'running'

export interface EvaluationRun {
  completedAt: Nullable<string>
  errorMessage: Nullable<string>
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
  targetRef: Nullable<string>
}

export interface EvaluationTrendPoint {
  averageMetricValue: number
  firstMetricAt: Nullable<string>
  lastMetricAt: Nullable<string>
  metricName: string
  sampleCount: number
}

export interface TriggerEvaluationResponse {
  message: string
  status: 'queued'
}
