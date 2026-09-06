import type { Repository } from '@workspace/codepath-common/repository'

import type { CreateRepoFormData } from '@/utils/validators/createRepoForm'

import { baseApi } from './baseApi'

const reposApiWithTags = baseApi.enhanceEndpoints({
  addTagTypes: ['Repos']
})

export const reposApi = reposApiWithTags.injectEndpoints({
  endpoints: builder => ({
    createRepo: builder.mutation<Repository, CreateRepoFormData>({
      invalidatesTags: ['Repos'],
      query: repo => ({
        data: repo,
        method: 'POST',
        url: '/repo'
      })
    }),
    getRepos: builder.query<Repository[], void>({
      providesTags: ['Repos'],
      query: () => ({ url: '/repo' })
    })
  })
})

export const { useCreateRepoMutation, useGetReposQuery } = reposApi
