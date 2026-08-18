import type { Nullable } from '@workspace/codepath-common/globals'
import {
  type RepoCloneStatus,
  type RepoDocsModule,
  type RepoDocsProgress,
  type RepoDocsStatus,
  type RepoEmbeddingStatus,
  type Repository
} from '@workspace/codepath-common/repository'

import { baseApi } from './baseApi'

export interface RepoDocsStatusResponse {
  cloneStatus: RepoCloneStatus
  docsProgress: Nullable<RepoDocsProgress>
  docsStatus: RepoDocsStatus
  embeddingStatus: RepoEmbeddingStatus
  id: number
  lastPipelineError: Nullable<string>
  pipelineUpdatedAt: Nullable<string>
}

interface GenerateRepoDocsResponse {
  message: string
  status: 'processing'
}

type RepoPipelineStatus = Pick<
  Repository,
  | 'cloneStatus'
  | 'docsStatus'
  | 'embeddingStatus'
  | 'id'
  | 'lastPipelineError'
  | 'pipelineUpdatedAt'
>

const docsApiWithTags = baseApi.enhanceEndpoints({
  addTagTypes: ['RepoDocs', 'RepoDocsModules', 'RepoDocsStatus']
})

export const docsApi = docsApiWithTags.injectEndpoints({
  endpoints: builder => ({
    generateRepoDocs: builder.mutation<GenerateRepoDocsResponse, number>({
      invalidatesTags: (_result, _error, repoId) => [
        { id: repoId, type: 'RepoDocs' },
        { id: repoId, type: 'RepoDocsModules' },
        { id: repoId, type: 'RepoDocsStatus' }
      ],
      query: repoId => ({ data: {}, method: 'POST', url: `/docs/generate/${repoId}` })
    }),
    generateRepoDocsModule: builder.mutation<GenerateRepoDocsResponse, { moduleKey: string; repoId: number; }>({
      invalidatesTags: (_result, _error, { repoId }) => [
        { id: repoId, type: 'RepoDocs' },
        { id: repoId, type: 'RepoDocsModules' },
        { id: repoId, type: 'RepoDocsStatus' }
      ],
      query: ({ moduleKey, repoId }) => ({
        data: {},
        method: 'POST',
        url: `/docs/generate/${repoId}/modules/${encodeURIComponent(moduleKey)}`
      })
    }),
    generateRepoDocsSection: builder.mutation<GenerateRepoDocsResponse, { moduleKey: string; repoId: number; sectionKey: string; }>({
      invalidatesTags: (_result, _error, { repoId }) => [
        { id: repoId, type: 'RepoDocs' },
        { id: repoId, type: 'RepoDocsModules' },
        { id: repoId, type: 'RepoDocsStatus' }
      ],
      query: ({ moduleKey, repoId, sectionKey }) => ({
        data: {},
        method: 'POST',
        url: `/docs/generate/${repoId}/modules/${encodeURIComponent(moduleKey)}/sections/${encodeURIComponent(sectionKey)}`
      })
    }),
    getRepoDocs: builder.query<Nullable<string>, number>({
      providesTags: (_result, _error, repoId) => [{ id: repoId, type: 'RepoDocs' }],
      query: repoId => ({ url: `/docs/${repoId}` })
    }),
    getRepoDocsModules: builder.query<RepoDocsModule[], number>({
      providesTags: (_result, _error, repoId) => [{ id: repoId, type: 'RepoDocsModules' }],
      query: repoId => ({ url: `/docs/${repoId}/modules` })
    }),
    getRepoDocsStatus: builder.query<RepoDocsStatusResponse, number>({
      providesTags: (_result, _error, repoId) => [{ id: repoId, type: 'RepoDocsStatus' }],
      query: repoId => ({ url: `/docs/status/${repoId}` })
    }),
    retryRepoClone: builder.mutation<RepoPipelineStatus, number>({
      invalidatesTags: (_result, _error, repoId) => [
        { id: repoId, type: 'RepoDocs' },
        { id: repoId, type: 'RepoDocsModules' },
        { id: repoId, type: 'RepoDocsStatus' }
      ],
      query: repoId => ({
        data: {},
        method: 'POST',
        url: `/repo/${repoId}/retry-clone`
      })
    }),
    retryRepoIngest: builder.mutation<RepoPipelineStatus, number>({
      invalidatesTags: (_result, _error, repoId) => [
        { id: repoId, type: 'RepoDocs' },
        { id: repoId, type: 'RepoDocsModules' },
        { id: repoId, type: 'RepoDocsStatus' }
      ],
      query: repoId => ({
        data: {},
        method: 'POST',
        url: `/repo/${repoId}/retry-ingest`
      })
    })
  })
})

export const {
  useGenerateRepoDocsModuleMutation,
  useGenerateRepoDocsMutation,
  useGenerateRepoDocsSectionMutation,
  useGetRepoDocsModulesQuery,
  useGetRepoDocsQuery,
  useGetRepoDocsStatusQuery,
  useRetryRepoCloneMutation,
  useRetryRepoIngestMutation
} = docsApi
