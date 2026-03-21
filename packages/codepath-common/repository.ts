export type RepoCloneStatus = 'pending' | 'cloned' | 'cloning' | 'failed'
export type RepoEmbeddingStatus = 'pending' | 'processing' | 'embedded' | 'failed'

export interface Repository {
  id: number
  name: string
  cloneStatus: RepoCloneStatus
  embeddingStatus: RepoEmbeddingStatus
}
