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
