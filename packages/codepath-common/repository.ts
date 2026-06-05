import { Nullable } from './globals'

export type RepoCloneStatus = 'pending' | 'cloned' | 'cloning' | 'failed'
export type RepoEmbeddingStatus = 'pending' | 'processing' | 'embedded' | 'failed'
export type RepoDocsStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface Repository {
  id: number
  name: string
  cloneStatus: RepoCloneStatus
  embeddingStatus: RepoEmbeddingStatus
  docsStatus: RepoDocsStatus
  pipelineUpdatedAt: Nullable<string>
  lastPipelineError: Nullable<string>
}
