import { apiClient } from '@/lib/api/api'

export async function runEmbedding(repoId: number) {
  return await apiClient.get<{ message: string }>(`/embedding/${repoId}`)
}

export async function shouldBeEmbedded(repoId: number) {
  return await apiClient.get<boolean>(`/embedding/shouldBeEmbedded/${repoId}`)
}
