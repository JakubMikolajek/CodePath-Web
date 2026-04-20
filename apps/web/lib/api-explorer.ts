import type {
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoInteractiveApi,
  RepoOpenApiDocument
} from '@workspace/codepath-common/api-explorer'

import { apiClient } from '@/lib/api/api'

interface InteractiveApiFilters {
  frameworks?: RepoApiFramework[]
  methods?: RepoApiHttpMethod[]
  search?: string
}

export async function getRepoInteractiveApi(repoId: number, filters?: InteractiveApiFilters) {
  return await apiClient.get<RepoInteractiveApi>(`/api-explorer/${repoId}`, {
    params: {
      frameworks: filters?.frameworks?.length ? filters.frameworks.join(',') : undefined,
      methods: filters?.methods?.length ? filters.methods.join(',') : undefined,
      search: filters?.search?.trim() || undefined
    }
  })
}

export async function getRepoInteractiveApiJson(repoId: number, filters?: InteractiveApiFilters) {
  return await apiClient.get<RepoInteractiveApi>(`/api-explorer/${repoId}/endpoints.json`, {
    params: {
      frameworks: filters?.frameworks?.length ? filters.frameworks.join(',') : undefined,
      methods: filters?.methods?.length ? filters.methods.join(',') : undefined,
      search: filters?.search?.trim() || undefined
    }
  })
}

export async function getRepoOpenApiSpec(repoId: number, filters?: InteractiveApiFilters) {
  return await apiClient.get<RepoOpenApiDocument>(`/api-explorer/${repoId}/openapi.json`, {
    params: {
      frameworks: filters?.frameworks?.length ? filters.frameworks.join(',') : undefined,
      methods: filters?.methods?.length ? filters.methods.join(',') : undefined,
      search: filters?.search?.trim() || undefined
    }
  })
}
