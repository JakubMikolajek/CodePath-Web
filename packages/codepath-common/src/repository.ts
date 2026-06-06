import { Nullable } from './globals'

export enum RepoCloneStatus {
  CLONED = 'cloned',
  CLONING = 'cloning',
  FAILED = 'failed',
  PENDING = 'pending'
}

export enum RepoEmbeddingStatus {
  EMBEDDED = 'embedded',
  FAILED = 'failed',
  PENDING = 'pending',
  PROCESSING = 'processing'
}

export enum RepoDocsStatus {
  FAILED = 'failed',
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready'
}

export interface Repository {
  id: number
  name: string
  cloneStatus: RepoCloneStatus
  embeddingStatus: RepoEmbeddingStatus
  docsStatus: RepoDocsStatus
  pipelineUpdatedAt: Nullable<string>
  lastPipelineError: Nullable<string>
}
