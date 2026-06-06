import {Nullable} from "./globals";

export enum RepoApiFramework {
  DJANGO = 'django',
  EXPRESS = 'express',
  FASTAPI = 'fastapi',
  FLASK = 'flask',
  NESTJS = 'nestjs',
  UNKNOWN = 'unknown'
}

export enum RepoApiHttpMethod {
  DELETE = 'DELETE',
  GET = 'GET',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  PATCH = 'PATCH',
  POST = 'POST',
  PUT = 'PUT'
}

export enum RepoApiParameterLocation {
  BODY = 'body',
  HEADER = 'header',
  PATH = 'path',
  QUERY = 'query'
}

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
  moduleName?: string
  params: RepoApiEndpointParameter[]
  path: string
  requestBodyTypeName?: string
  sourceLineStart?: number
  sourceSnippet?: string
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
    avgParamsPerEndpoint: number
    endpointDistributionByFramework: Partial<Record<RepoApiFramework, number>>
    endpointDistributionByMethod: Partial<Record<RepoApiHttpMethod, number>>
    endpointCount: number
    endpointsWithRequestBodyModel: number
    endpointsWithSourceSnippet: number
    frameworks: RepoApiFramework[]
    moduleCount: number
    modules: string[]
    requestBodyModelCoverage: number
    repoId: number
    repoName: string
    segmentCount: number
    sourceSnippetCoverage: number
  }
}

export enum RepoOpenApiOperationMethod {
  DELETE = 'delete',
  GET = 'get',
  HEAD = 'head',
  OPTIONS = 'options',
  PATCH = 'patch',
  POST = 'post',
  PUT = 'put'
}

export enum OpenApiVersion {
  V3_1_0 = '3.1.0'
}

export enum RepoOpenApiSchemaType {
  ARRAY = 'array',
  BOOLEAN = 'boolean',
  INTEGER = 'integer',
  NUMBER = 'number',
  OBJECT = 'object',
  STRING = 'string'
}

export type RepoOpenApiSchema = { $ref: string } | {
  additionalProperties?: boolean
  items?: RepoOpenApiSchema
  properties?: Record<string, RepoOpenApiSchema>
  required?: string[]
  type: RepoOpenApiSchemaType
}

export enum RepoOpenApiParameterIn {
  HEADER = 'header',
  PATH = 'path',
  QUERY = 'query'
}

export interface RepoOpenApiParameter {
  in: RepoOpenApiParameterIn
  name: string
  required: boolean
  schema: RepoOpenApiSchema
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
        schema: RepoOpenApiSchema
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
  components?: {
    schemas?: Record<string, RepoOpenApiSchema>
  }
  info: {
    description: string
    title: string
    version: string
  }
  openapi: OpenApiVersion
  paths: Record<string, Partial<Record<RepoOpenApiOperationMethod, RepoOpenApiOperation>>>
  tags?: Array<{ name: string }>
  'x-codepath-metrics'?: {
    codeSourceCoverage: number
    mergedOperationCount: number
    moduleTagCount: number
    operationCount: number
    operationsWithCodeSource: number
    runtimeOperationCount: number
    runtimeResolvedUrl?: string
    schemaComponentCount: number
    sourceMode: RepoOpenApiSourceMode
    staticOperationCount: number
  }
}

export enum RepoOpenApiSourceMode {
  HYBRID = 'hybrid',
  RUNTIME = 'runtime',
  STATIC = 'static'
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

export enum RepoApiRunnerAuthMode {
  API_KEY = 'apiKey',
  BASIC = 'basic',
  BEARER = 'bearer',
  NONE = 'none'
}

export enum RepoApiRunnerApiKeyPlacement {
  HEADER = 'header',
  QUERY = 'query'
}

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
  endpointId: Nullable<string>
  endpointMethod: Nullable<RepoApiHttpMethod>
  endpointPath: Nullable<string>
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

export interface RepoApiRunnerAuthPreset {
  config: RepoApiRunnerAuthConfig
  createdAt: string
  id: number
  name: string
  updatedAt: string
}

export interface RepoApiRunnerSaveAuthPresetRequest {
  config: RepoApiRunnerAuthConfig
  name: string
}
