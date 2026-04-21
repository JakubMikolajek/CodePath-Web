export type RepoApiFramework = 'django' | 'express' | 'fastapi' | 'flask' | 'nestjs' | 'unknown'

export type RepoApiHttpMethod =
  | 'DELETE'
  | 'GET'
  | 'HEAD'
  | 'OPTIONS'
  | 'PATCH'
  | 'POST'
  | 'PUT'

export type RepoApiParameterLocation = 'body' | 'header' | 'path' | 'query'

export interface RepoApiEndpointParameter {
  location: RepoApiParameterLocation
  name: string
  required: boolean
}

export interface RepoApiEndpoint {
  filePath: string
  framework: RepoApiFramework
  id: string
  method: RepoApiHttpMethod
  params: RepoApiEndpointParameter[]
  path: string
  symbolName?: string
}

export interface RepoInteractiveApiFilters {
  frameworks?: RepoApiFramework[]
  methods?: RepoApiHttpMethod[]
  search?: string
}

export interface RepoInteractiveApi {
  endpoints: RepoApiEndpoint[]
  filters: RepoInteractiveApiFilters
  generatedAt: string
  metadata: {
    endpointCount: number
    frameworks: RepoApiFramework[]
    repoId: number
    repoName: string
    segmentCount: number
  }
}

export type RepoOpenApiOperationMethod = 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put'

export interface RepoOpenApiParameter {
  in: 'header' | 'path' | 'query'
  name: string
  required: boolean
  schema: {
    type: 'string'
  }
}

export interface RepoOpenApiSourceMetadata {
  filePath: string
  framework: RepoApiFramework
  symbolName?: string
}

export interface RepoOpenApiOperation {
  operationId: string
  parameters?: RepoOpenApiParameter[]
  requestBody?: {
    content: {
      'application/json': {
        schema: {
          additionalProperties?: boolean
          properties?: Record<string, { type: 'string' }>
          required?: string[]
          type: 'object'
        }
      }
    }
    required: boolean
  }
  responses: Record<string, { description: string }>
  summary: string
  tags: string[]
  'x-codepath'?: RepoOpenApiSourceMetadata
  'x-codepath-sources'?: RepoOpenApiSourceMetadata[]
}

export interface RepoOpenApiDocument {
  info: {
    description: string
    title: string
    version: string
  }
  openapi: '3.1.0'
  paths: Record<string, Partial<Record<RepoOpenApiOperationMethod, RepoOpenApiOperation>>>
}

export interface RepoApiRunnerRequest {
  body?: unknown
  headers?: Record<string, string>
  method: RepoApiHttpMethod
  timeoutMs?: number
  url: string
}

export interface RepoApiRunnerResponse {
  data: unknown
  durationMs: number
  headers: Record<string, string>
  ok: boolean
  status: number
  statusText: string
  url: string
}

export type RepoApiRunnerAuthMode = 'apiKey' | 'basic' | 'bearer' | 'none'
export type RepoApiRunnerApiKeyPlacement = 'header' | 'query'

export interface RepoApiRunnerAuthConfig {
  apiKeyName: string
  apiKeyPlacement: RepoApiRunnerApiKeyPlacement
  apiKeyValue: string
  basicPassword: string
  basicUsername: string
  bearerToken: string
  mode: RepoApiRunnerAuthMode
}

export interface RepoApiRunnerCollectionConfig {
  auth: RepoApiRunnerAuthConfig
  baseUrl: string
  bodyJson: string
  endpointId: null | string
  endpointMethod: null | RepoApiHttpMethod
  endpointPath: null | string
  headersJson: string
  pathValues: Record<string, string>
  queryJson: string
  timeoutMs: number
}

export interface RepoApiRunnerCollection {
  config: RepoApiRunnerCollectionConfig
  createdAt: string
  id: number
  name: string
  updatedAt: string
}

export interface RepoApiRunnerSaveCollectionRequest {
  config: RepoApiRunnerCollectionConfig
  name: string
}
