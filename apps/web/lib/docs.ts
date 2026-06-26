import type { Nullable } from '@workspace/codepath-common/globals'
import type { RepoCloneStatus, RepoDocsModule, RepoDocsProgress, RepoDocsStatus, RepoEmbeddingStatus } from '@workspace/codepath-common/repository'

import { apiClient } from '@/lib/api/api'

export interface RepoDocsStatusResponse {
  cloneStatus: RepoCloneStatus
  docsProgress: Nullable<RepoDocsProgress>
  docsStatus: RepoDocsStatus
  embeddingStatus: RepoEmbeddingStatus
  id: number
  lastPipelineError: Nullable<string>
  pipelineUpdatedAt: Nullable<string>
}

interface GenerateRepoDocsResponse {
  message: string
  status: 'processing'
}

export async function getRepoDocs(repoId: number) {
  return apiClient.get<Nullable<string>>(`/docs/${repoId}`)
}

export async function getRepoDocsModules(repoId: number) {
  return apiClient.get<RepoDocsModule[]>(`/docs/${repoId}/modules`)
}

export async function getRepoDocsStatus(repoId: number) {
  return apiClient.get<RepoDocsStatusResponse>(`/docs/status/${repoId}`)
}

export async function generateRepoDocs(repoId: number) {
  return apiClient.post<GenerateRepoDocsResponse, Record<string, never>>(`/docs/generate/${repoId}`, {})
}

export async function generateRepoDocsModule(repoId: number, moduleKey: string) {
  return apiClient.post<GenerateRepoDocsResponse, Record<string, never>>(`/docs/generate/${repoId}/modules/${encodeURIComponent(moduleKey)}`, {})
}

export async function generateRepoDocsSection(repoId: number, moduleKey: string, sectionKey: string) {
  return apiClient.post<GenerateRepoDocsResponse, Record<string, never>>(`/docs/generate/${repoId}/modules/${encodeURIComponent(moduleKey)}/sections/${encodeURIComponent(sectionKey)}`, {})
}
