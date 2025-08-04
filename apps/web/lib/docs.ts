import { apiClient } from '@/lib//api/api'

export async function getRepoDocs(repoId: number) {
  return await apiClient.get(`/docs/generate/${repoId}`)
}

