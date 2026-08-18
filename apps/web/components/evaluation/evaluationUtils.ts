import type { Nullable } from '@workspace/codepath-common'

import type { EvaluationRunStatus, EvaluationRunType } from '@/lib/evaluations'

export const RUN_TYPE_LABELS: Record<EvaluationRunType, string> = {
  chat_faithfulness: 'Chat faithfulness',
  docs_quality: 'Docs quality',
  full: 'Full',
  retrieval: 'Retrieval'
}

export const LINE_COLORS = ['#7dd3fc', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#f472b6', '#60a5fa']

export const errorMessage = (error: unknown, fallback: string) =>
  typeof error === 'object'
  && error !== null
  && 'data' in error
  && typeof (error as { data?: unknown }).data === 'string'
    ? (error as { data: string }).data
    : fallback

export const formatDateTime = (value: Nullable<string>) => {
  if (!value) return 'Not completed'

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed)
}

export const formatShortDateTime = (value: number) => new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short'
}).format(new Date(value))

export const formatMetricValue = (value: number) => {
  if (!Number.isFinite(value)) return 'n/a'
  if (Math.abs(value) >= 100) return value.toFixed(1)

  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

export const getStatusTone = (status: EvaluationRunStatus) => {
  if (status === 'completed') return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
  if (status === 'failed') return 'border-red-300/35 bg-red-300/10 text-red-200'
  if (status === 'running') return 'border-cyan-300/35 bg-cyan-300/10 text-cyan-200'

  return 'border-amber-300/35 bg-amber-300/10 text-amber-200'
}

export const getStatusDot = (status: EvaluationRunStatus) => {
  if (status === 'completed') return 'bg-emerald-300'
  if (status === 'failed') return 'bg-red-300'
  if (status === 'running') return 'bg-cyan-300'

  return 'bg-amber-300'
}
