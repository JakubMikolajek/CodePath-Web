import { Graph } from '@workspace/codepath-common/graph'

import { apiClient } from '@/lib/api/api'

export async function getRepoGraphs(repoId: number) {
  return await apiClient.get<Graph[]>(`/dependencies/${repoId}`)
}
