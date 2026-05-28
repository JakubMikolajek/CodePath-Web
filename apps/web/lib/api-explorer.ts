import type {
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoApiRunnerAuthPreset,
  RepoApiRunnerCollection,
  RepoApiRunnerCollectionConfig,
  RepoApiRunnerRequest,
  RepoApiRunnerResponse,
  RepoApiRunnerSaveAuthPresetRequest,
  RepoApiRunnerSaveCollectionRequest,
  RepoInteractiveApi,
  RepoOpenApiDocument
} from '@workspace/codepath-common/api-explorer'

import { apiClient } from '@/lib/api/api'

interface InteractiveApiFilters {
  frameworks?: RepoApiFramework[]
  methods?: RepoApiHttpMethod[]
  runtimeBaseUrl?: string
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
      runtimeBaseUrl: filters?.runtimeBaseUrl?.trim() || undefined,
      search: filters?.search?.trim() || undefined
    }
  })
}

export async function runRepoApiRequest(repoId: number, payload: RepoApiRunnerRequest) {
  return await apiClient.post<RepoApiRunnerResponse, RepoApiRunnerRequest>(`/api-explorer/${repoId}/run`, payload)
}

export async function listRepoRunnerCollections(repoId: number) {
  return await apiClient.get<RepoApiRunnerCollection[]>(`/api-explorer/${repoId}/collections`)
}

export async function saveRepoRunnerCollection(repoId: number, payload: RepoApiRunnerSaveCollectionRequest) {
  return await apiClient.post<RepoApiRunnerCollection, RepoApiRunnerSaveCollectionRequest>(`/api-explorer/${repoId}/collections`, payload)
}

export async function deleteRepoRunnerCollection(repoId: number, collectionId: number) {
  return await apiClient.delete<{ id: number, ok: true }>(`/api-explorer/${repoId}/collections/${collectionId}`)
}

export async function listRepoRunnerAuthPresets(repoId: number) {
  return await apiClient.get<RepoApiRunnerAuthPreset[]>(`/api-explorer/${repoId}/auth-presets`)
}

export async function saveRepoRunnerAuthPreset(repoId: number, payload: RepoApiRunnerSaveAuthPresetRequest) {
  return await apiClient.post<RepoApiRunnerAuthPreset, RepoApiRunnerSaveAuthPresetRequest>(`/api-explorer/${repoId}/auth-presets`, payload)
}

export async function deleteRepoRunnerAuthPreset(repoId: number, presetId: number) {
  return await apiClient.delete<{ id: number, ok: true }>(`/api-explorer/${repoId}/auth-presets/${presetId}`)
}

export function createDefaultRunnerAuthConfig(): RepoApiRunnerCollectionConfig['auth'] {
  return {
    apiKeyName: 'x-api-key',
    apiKeyPlacement: 'header',
    apiKeyValue: '',
    basicPassword: '',
    basicUsername: '',
    bearerToken: '',
    mode: 'none'
  }
}
