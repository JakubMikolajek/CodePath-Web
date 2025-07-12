import { DependencyEdge } from '@/interfaces/dependencies'
import { apiClient } from '@/lib/api/api'

export async function getRepoDependencies(repoId: number) {
  return await apiClient.get<DependencyEdge[]>(`/dependencies/${repoId}`)
}
