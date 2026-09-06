import type { Nullable } from '@workspace/codepath-common/globals'
import {
  RepoCloneStatus,
  RepoDocsStatus,
  RepoEmbeddingStatus
} from '@workspace/codepath-common/repository'

import type { RepoDocsStatusResponse } from '@/redux/api/docsApi'

// Safety net only — RealtimeProvider patches this cache on repo.pipeline.updated WS events
export const DOCS_STATUS_POLL_MS = 60_000

export const resolveErrorMessage = (error: unknown) =>
  typeof error === 'object'
  && error !== null
  && 'data' in error
  && typeof (error as { data?: unknown }).data === 'string'
    ? (error as { data: string }).data
    : error instanceof Error
      ? error.message
      : 'Unexpected error'

export const formatStatus = (status: string) => status.replaceAll('_', ' ')

export const formatDateTime = (value: Nullable<string>) => {
  if (!value) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export const isPipelineWaitingOrRunning = (status: RepoDocsStatusResponse) => (
  status.cloneStatus === RepoCloneStatus.PENDING
  || status.cloneStatus === RepoCloneStatus.CLONING
  || status.embeddingStatus === RepoEmbeddingStatus.PENDING
  || status.embeddingStatus === RepoEmbeddingStatus.PROCESSING
  || status.docsStatus === RepoDocsStatus.PROCESSING
)

export const getStatusTone = (status?: string) => {
  if (status === 'ready' || status === 'embedded' || status === 'cloned') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
  if (status === 'processing') return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
  if (status === 'failed') return 'border-red-400/30 bg-red-400/10 text-red-200'

  return 'border-white/10 bg-white/5 text-muted-foreground'
}
