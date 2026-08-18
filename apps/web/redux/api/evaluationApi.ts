import type {
  EvaluationMetric,
  EvaluationRun,
  EvaluationRunType,
  EvaluationTrendPoint,
  TriggerEvaluationResponse
} from '@/lib/evaluations'

import { baseApi } from './baseApi'

export const evaluationApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getRepoEvaluationRuns: builder.query<EvaluationRun[], { limit?: number; repoId: number; }>({
      providesTags: (_result, _error, { repoId }) => [{ id: repoId, type: 'EvaluationRuns' }],
      query: ({ limit, repoId }) => ({ params: { limit }, url: `/evaluation/${repoId}/runs` })
    }),
    getRepoEvaluationTrend: builder.query<EvaluationTrendPoint[], number>({
      providesTags: (_result, _error, repoId) => [{ id: repoId, type: 'EvaluationTrend' }],
      query: repoId => ({ url: `/evaluation/${repoId}/trend` })
    }),
    getRunMetrics: builder.query<EvaluationMetric[], { repoId: number; runId: number; }>({
      query: ({ repoId, runId }) => ({ url: `/evaluation/${repoId}/runs/${runId}/metrics` })
    }),
    triggerEvaluationRun: builder.mutation<TriggerEvaluationResponse, { repoId: number; runType: EvaluationRunType; }>({
      invalidatesTags: (_result, _error, { repoId }) => [
        { id: repoId, type: 'EvaluationRuns' },
        { id: repoId, type: 'EvaluationTrend' }
      ],
      query: ({ repoId, runType }) => ({
        data: { runType },
        method: 'POST',
        url: `/evaluation/${repoId}/trigger`
      })
    })
  })
})

export const {
  useGetRepoEvaluationRunsQuery,
  useGetRepoEvaluationTrendQuery,
  useGetRunMetricsQuery,
  useTriggerEvaluationRunMutation
} = evaluationApi
