import type { Nullable } from '@workspace/codepath-common/globals'
import {
  RepoCloneStatus,
  RepoDocsStatus,
  RepoEmbeddingStatus
} from '@workspace/codepath-common/repository'

import type { RepoDocsStatusResponse } from '@/redux/api/docsApi'

// Safety net only — RealtimeProvider patches this cache on repo.pipeline.updated WS events
export const DOCS_STATUS_POLL_MS = 60_000

// While documentation is being generated sections are saved one by one, so the view refreshes much faster.
export const DOCS_GENERATION_POLL_MS = 5_000

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

export const getDocsPollInterval = (status: RepoDocsStatusResponse | undefined) => {
  if (!status) return 0
  if (status.docsStatus === RepoDocsStatus.PROCESSING) return DOCS_GENERATION_POLL_MS

  return isPipelineWaitingOrRunning(status) ? DOCS_STATUS_POLL_MS : 0
}

export type ConfirmableDocsAction = 'clone' | 'generate' | 'ingest'

// These actions delete every generated fragment of the repository before doing their work.
export const CONFIRMABLE_DOCS_ACTION_COPY: Record<ConfirmableDocsAction, { confirmLabel: string, description: string, title: string }> = {
  clone: {
    confirmLabel: 'Restart clone',
    description: 'The repository is cloned again and ingest, embeddings and documentation run from scratch. All generated documentation is deleted first and is not restored if a later step fails. Export it first if you want to keep it.',
    title: 'Restart the whole pipeline?'
  },
  generate: {
    confirmLabel: 'Delete and generate',
    description: 'All generated documentation for this repository is deleted before generation starts. If generation fails, the previous version is not restored. Export it first if you want to keep it.',
    title: 'Generate documentation from scratch?'
  },
  ingest: {
    confirmLabel: 'Restart ingest',
    description: 'The current snapshot is ingested again and embeddings are rebuilt. All generated documentation is deleted first and is not restored if a later step fails. Export it first if you want to keep it.',
    title: 'Restart ingest?'
  }
}
