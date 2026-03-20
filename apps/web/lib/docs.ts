import { apiClient } from '@/lib/api/api'

export async function getRepoDocs(repoId: number) {
  return await apiClient.get<string | null>(`/docs/${repoId}`)
}
