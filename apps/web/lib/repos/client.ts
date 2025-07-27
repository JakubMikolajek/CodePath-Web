import { Repository } from '@workspace/codepath-common/repository'

import { apiClient } from '../api/api'

import { CreateRepoFormData } from '@/utils/validators/createRepoForm'

export async function createRepo(repo: CreateRepoFormData) {
  return await apiClient.post<Repository, CreateRepoFormData>('/repo', repo)
}

