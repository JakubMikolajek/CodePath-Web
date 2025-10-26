import type { Repository } from '@workspace/codepath-common/repository'

import type { CreateRepoFormData } from '@/utils/validators/createRepoForm'

import { apiClient } from '../api/api'

export async function createRepo(repo: CreateRepoFormData) {
  return await apiClient.post<Repository, CreateRepoFormData>('/repo', repo)
}
