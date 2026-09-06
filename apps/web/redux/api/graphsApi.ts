import type {
  Graph,
  RepoGraphEdgeType,
  RepoInteractiveGraph
} from '@workspace/codepath-common/graph'

import { baseApi } from './baseApi'

export interface RepoInteractiveGraphFilters {
  depth?: number
  focusNodeId?: string
  includeSymbols?: boolean
  relationTypes?: RepoGraphEdgeType[]
}

export interface RepoInteractiveGraphQuery extends RepoInteractiveGraphFilters {
  repoId: number
}

export const graphsApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getRepoGraphs: builder.query<Graph[], number>({ query: repoId => ({ url: `/dependencies/${repoId}` }) }),
    getRepoInteractiveGraph: builder.query<RepoInteractiveGraph, RepoInteractiveGraphQuery>({
      query: ({ relationTypes, repoId, ...filters }) => ({
        params: { ...filters, relationTypes: relationTypes?.length ? relationTypes.join(',') : undefined },
        url: `/dependencies/${repoId}/interactive`
      })
    })
  })
})

export const {
  useGetRepoGraphsQuery,
  useGetRepoInteractiveGraphQuery
} = graphsApi
