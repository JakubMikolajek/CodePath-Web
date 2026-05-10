import type { Nullable } from '@workspace/codepath-common/globals'
import type { RepoCloneStatus, RepoDocsStatus, RepoEmbeddingStatus } from '@workspace/codepath-common/repository'

import { apiClient } from '@/lib/api/api'

export interface RepoDocsStatusResponse {
  cloneStatus: RepoCloneStatus
  docsStatus: RepoDocsStatus
  embeddingStatus: RepoEmbeddingStatus
  id: number
}

interface GenerateRepoDocsResponse {
  message: string
  status: 'processing'
}

export async function getRepoDocs(repoId: number) {
  return apiClient.get<Nullable<string>>(`/docs/${repoId}`)
}

export async function getRepoDocsStatus(repoId: number) {
  return apiClient.get<RepoDocsStatusResponse>(`/docs/status/${repoId}`)
}

export async function generateRepoDocs(repoId: number) {
  return apiClient.post<GenerateRepoDocsResponse, Record<string, never>>(`/docs/generate/${repoId}`, {})
}
