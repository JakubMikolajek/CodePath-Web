import { Repository } from '@workspace/codepath-common/repository'

import { apiClient } from '@/lib/api/api'
import { CreateRepoFormData } from '@/utils/validators/createRepoForm'

export async function getRepos() {
  return await apiClient.get<Repository[]>('/repo')
}

export async function createRepo(repo: CreateRepoFormData) {
  return await apiClient.post<Repository, CreateRepoFormData>('/repo', repo)
}
