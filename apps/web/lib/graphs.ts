import type { Graph, RepoGraphEdgeType, RepoInteractiveGraph } from '@workspace/codepath-common/graph'

import { apiClient } from '@/lib/api/api'

export async function getRepoGraphs(repoId: number) {
  return await apiClient.get<Graph[]>(`/dependencies/${repoId}`)
}

export async function getRepoInteractiveGraph(
  repoId: number,
  filters?: {
    depth?: number
    focusNodeId?: string
    includeSymbols?: boolean
    relationTypes?: RepoGraphEdgeType[]
  }
) {
  const relationTypes = filters?.relationTypes?.length ? filters.relationTypes.join(',') : undefined

  return await apiClient.get<RepoInteractiveGraph>(`/dependencies/${repoId}/interactive`, {
    params: {
      depth: filters?.depth,
      focusNodeId: filters?.focusNodeId,
      includeSymbols: filters?.includeSymbols,
      relationTypes
    }
  })
}
