import { Repo } from '@/interfaces/repo'
import { apiClient } from '@/lib/api/api'
import { CreateRepoFormData } from '@/utils/validators/createRepoForm'

export async function getRepos() {
  return await apiClient.get<Repo[]>('/repo')
}

export async function createRepo(repo: CreateRepoFormData) {
  return await apiClient.post<Repo, CreateRepoFormData>('/repo', repo)
}
