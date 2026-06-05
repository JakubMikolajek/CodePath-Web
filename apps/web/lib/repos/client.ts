import type { Repository } from '@workspace/codepath-common/repository'

import type { CreateRepoFormData } from '@/utils/validators/createRepoForm'

import { apiClient } from '../api/api'

type RepoPipelineStatus = Pick<Repository, 'cloneStatus' | 'docsStatus' | 'embeddingStatus' | 'id' | 'lastPipelineError' | 'pipelineUpdatedAt'>

export async function getRepos() {
  return await apiClient.get<Repository[]>('/repo')
}

export async function createRepo(repo: CreateRepoFormData) {
  return await apiClient.post<Repository, CreateRepoFormData>('/repo', repo)
}

export async function retryRepoClone(repoId: number) {
  return await apiClient.post<RepoPipelineStatus, Record<string, never>>(`/repo/${repoId}/retry-clone`, {})
}

export async function retryRepoIngest(repoId: number) {
  return await apiClient.post<RepoPipelineStatus, Record<string, never>>(`/repo/${repoId}/retry-ingest`, {})
}
