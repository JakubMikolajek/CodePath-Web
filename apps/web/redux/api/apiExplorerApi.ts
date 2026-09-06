import type {
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoApiRunnerAuthPreset,
  RepoApiRunnerCollection,
  RepoApiRunnerRequest,
  RepoApiRunnerResponse,
  RepoApiRunnerSaveAuthPresetRequest,
  RepoApiRunnerSaveCollectionRequest,
  RepoInteractiveApi,
  RepoOpenApiDocument
} from '@workspace/codepath-common/api-explorer'

import { baseApi } from './baseApi'

export interface InteractiveApiFilters {
  frameworks?: RepoApiFramework[];
  methods?: RepoApiHttpMethod[];
  runtimeBaseUrl?: string;
  search?: string;
}

const filterParams = (filters?: InteractiveApiFilters, includeRuntimeBaseUrl = false) => ({
  frameworks: filters?.frameworks?.length ? filters.frameworks.join(',') : undefined,
  methods: filters?.methods?.length ? filters.methods.join(',') : undefined,
  ...(includeRuntimeBaseUrl ? { runtimeBaseUrl: filters?.runtimeBaseUrl?.trim() || undefined } : {}),
  search: filters?.search?.trim() || undefined
})

// FIXME: maybe method could be enum or something :)
export const apiExplorerApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    deleteRepoRunnerAuthPreset: builder.mutation<{ id: number; ok: true }, { presetId: number; repoId: number }>({
      invalidatesTags: (_result, _error, { repoId }) => [{ id: repoId, type: 'AuthPreset' }],
      query: ({ presetId, repoId }) => ({ method: 'DELETE', url: `/api-explorer/${repoId}/auth-presets/${presetId}` })
    }),
    deleteRepoRunnerCollection: builder.mutation<{ id: number; ok: true }, { collectionId: number; repoId: number }>({
      invalidatesTags: (_result, _error, { repoId }) => [{ id: repoId, type: 'RunnerCollection' }],
      query: ({ collectionId, repoId }) => ({ method: 'DELETE', url: `/api-explorer/${repoId}/collections/${collectionId}` })
    }),
    getRepoInteractiveApi: builder.query<RepoInteractiveApi, { filters?: InteractiveApiFilters; repoId: number; }>({
      query: ({ filters, repoId }) => ({ params: filterParams(filters), url: `/api-explorer/${repoId}` })
    }),
    getRepoInteractiveApiJson: builder.query<RepoInteractiveApi, { filters?: InteractiveApiFilters; repoId: number; }>({
      query: ({ filters, repoId }) => ({ params: filterParams(filters), url: `/api-explorer/${repoId}/endpoints.json` })
    }),
    getRepoOpenApiSpec: builder.query<RepoOpenApiDocument, { filters?: InteractiveApiFilters; repoId: number; }>({
      query: ({ filters, repoId }) => ({ params: filterParams(filters, true), url: `/api-explorer/${repoId}/openapi.json` })
    }),
    listRepoRunnerAuthPresets: builder.query<RepoApiRunnerAuthPreset[], number>({
      providesTags: (_result, _error, repoId) => [{ id: repoId, type: 'AuthPreset' }],
      query: repoId => ({ url: `/api-explorer/${repoId}/auth-presets` })
    }),
    listRepoRunnerCollections: builder.query<RepoApiRunnerCollection[], number>({
      providesTags: (_result, _error, repoId) => [{ id: repoId, type: 'RunnerCollection' }],
      query: repoId => ({ url: `/api-explorer/${repoId}/collections` })
    }),
    runRepoApiRequest: builder.mutation<RepoApiRunnerResponse, { payload: RepoApiRunnerRequest; repoId: number; }>({
      query: ({ payload, repoId }) => ({ data: payload, method: 'POST', url: `/api-explorer/${repoId}/run` })
    }),
    saveRepoRunnerAuthPreset: builder.mutation<RepoApiRunnerAuthPreset, { payload: RepoApiRunnerSaveAuthPresetRequest; repoId: number; }>({
      invalidatesTags: (_result, _error, { repoId }) => [{ id: repoId, type: 'AuthPreset' }],
      query: ({ payload, repoId }) => ({ data: payload, method: 'POST', url: `/api-explorer/${repoId}/auth-presets` })
    }),
    saveRepoRunnerCollection: builder.mutation<RepoApiRunnerCollection, { payload: RepoApiRunnerSaveCollectionRequest; repoId: number; }>({
      invalidatesTags: (_result, _error, { repoId }) => [{ id: repoId, type: 'RunnerCollection' }],
      query: ({ payload, repoId }) => ({ data: payload, method: 'POST', url: `/api-explorer/${repoId}/collections` })
    })
  })
})

export const {
  useDeleteRepoRunnerAuthPresetMutation,
  useDeleteRepoRunnerCollectionMutation,
  useGetRepoInteractiveApiQuery,
  useLazyGetRepoInteractiveApiJsonQuery,
  useLazyGetRepoOpenApiSpecQuery,
  useListRepoRunnerAuthPresetsQuery,
  useListRepoRunnerCollectionsQuery,
  useRunRepoApiRequestMutation,
  useSaveRepoRunnerAuthPresetMutation,
  useSaveRepoRunnerCollectionMutation
} = apiExplorerApi
