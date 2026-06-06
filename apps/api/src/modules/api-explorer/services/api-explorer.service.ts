import { posix as pathPosix } from 'node:path'

import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type {
  RepoApiEndpoint,
  RepoApiEndpointParameter,
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoApiRunnerAuthPreset,
  RepoApiRunnerCollection,
  RepoApiRunnerRequest,
  RepoApiRunnerResponse,
  RepoApiRunnerSaveAuthPresetRequest,
  RepoApiRunnerSaveCollectionRequest,
  RepoInteractiveApi,
  RepoOpenApiDocument,
  RepoOpenApiSchema
} from '@workspace/codepath-common/api-explorer'
import type { AxiosInstance } from 'axios'
import { and, eq } from 'drizzle-orm'

import { env } from '../../../config/env'
import { repos } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { HTTP_CLIENT } from '../../http-client/http-client.tokens'
import { QdrantService } from '../../qdrant/services/qdrant.service'
import { OpenApiDocumentBuilder } from '../builders/openapi-document.builder'
import { ApiEndpointDetector } from '../detectors/api-endpoint.detector'
import type {
  ApiExplorerIngestSegmentPayload as IngestSegmentPayload,
  ApiExplorerQuery,
  ApiExplorerRepoOwnership as RepoOwnership,
  CanonicalApiFile as CanonicalFile
} from '../types/api-explorer-internal.types'
import { ApiRunnerService } from './api-runner.service'

const MAX_CONTENT_PER_FILE = 220_000
const MAX_SEGMENTS_PER_FILE = 400

const SUPPORTED_FRAMEWORKS: RepoApiFramework[] = [
  'django',
  'express',
  'fastapi',
  'flask',
  'nestjs',
  'unknown'
]

const SUPPORTED_METHODS: RepoApiHttpMethod[] = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT'
]

const RUNNER_MAX_RESPONSE_BYTES = 1_000_000
const RUNTIME_OPENAPI_TIMEOUT_MS = 6_000
const RUNTIME_OPENAPI_CANDIDATE_PATHS = [
  '/openapi.json',
  '/v3/api-docs',
  '/swagger.json',
  '/api/docs-json',
  '/api/openapi.json',
  '/api/swagger.json'
]

@Injectable()
export class ApiExplorerService {
  private readonly endpointDetector = new ApiEndpointDetector()
  private readonly logger = new Logger(ApiExplorerService.name)
  private readonly openApiBuilder = new OpenApiDocumentBuilder()

  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService,
    private readonly apiRunnerService: ApiRunnerService,
    @Inject(HTTP_CLIENT) private readonly httpClient: AxiosInstance
  ) {}

  async deleteRunnerAuthPreset(userId: number, repoId: number, presetId: number) {
    await this.assertRepoOwnership(userId, repoId)
    return await this.apiRunnerService.deleteRunnerAuthPreset(userId, repoId, presetId)
  }

  async deleteRunnerCollection(userId: number, repoId: number, collectionId: number) {
    await this.assertRepoOwnership(userId, repoId)
    return await this.apiRunnerService.deleteRunnerCollection(userId, repoId, collectionId)
  }

  async getRepoInteractiveApi(
    userId: number,
    repoId: number,
    query: ApiExplorerQuery
  ): Promise<RepoInteractiveApi> {
    const repo = await this.assertRepoOwnership(userId, repoId)
    const requestedFrameworks = this.parseFrameworks(query.frameworks)
    const requestedMethods = this.parseMethods(query.methods)
    const search = this.parseSearch(query.search)

    const segments = await this.fetchRepoSegmentsFromQdrant(repo.id)
    const files = this.buildCanonicalFiles(segments)
    const endpointsByKey = new Map<string, RepoApiEndpoint>()

    for (const file of files.values()) {
      const fileEndpoints = this.endpointDetector.detectEndpointsForFile(file)
      for (const endpoint of fileEndpoints) {
        this.upsertEndpoint(endpointsByKey, endpoint)
      }
    }

    let endpoints = [...endpointsByKey.values()]

    if (requestedFrameworks.length > 0) {
      endpoints = endpoints.filter(endpoint => requestedFrameworks.includes(endpoint.framework))
    }

    if (requestedMethods.length > 0) {
      endpoints = endpoints.filter(endpoint => requestedMethods.includes(endpoint.method))
    }

    if (search) {
      endpoints = endpoints.filter(endpoint => {
        const haystack = [
          endpoint.filePath,
          endpoint.framework,
          endpoint.method,
          endpoint.moduleName ?? '',
          endpoint.path,
          endpoint.requestBodyTypeName ?? '',
          endpoint.symbolName ?? ''
        ].join(' ').toLowerCase()

        return haystack.includes(search)
      })
    }

    endpoints.sort((a, b) => {
      const byModule = (a.moduleName ?? '').localeCompare(b.moduleName ?? '')
      if (byModule !== 0) {
        return byModule
      }

      const byMethod = a.method.localeCompare(b.method)
      if (byMethod !== 0) {
        return byMethod
      }

      const byPath = a.path.localeCompare(b.path)
      if (byPath !== 0) {
        return byPath
      }

      const byFramework = a.framework.localeCompare(b.framework)
      if (byFramework !== 0) {
        return byFramework
      }

      return a.filePath.localeCompare(b.filePath)
    })

    const frameworks = Array.from(new Set(endpoints.map(endpoint => endpoint.framework))).sort()
    const modules = Array.from(
      new Set(
        endpoints
          .map(endpoint => endpoint.moduleName?.trim())
          .filter((value): value is string => Boolean(value))
      )
    )
      .sort((a, b) => a.localeCompare(b))
    const endpointDistributionByFramework = this.countEndpointsByFramework(endpoints)
    const endpointDistributionByMethod = this.countEndpointsByMethod(endpoints)
    const endpointsWithRequestBodyModel = endpoints.filter(endpoint => (
      typeof endpoint.requestBodyTypeName === 'string' && endpoint.requestBodyTypeName.trim().length > 0
    )).length
    const endpointsWithSourceSnippet = endpoints.filter(endpoint => (
      typeof endpoint.sourceSnippet === 'string' && endpoint.sourceSnippet.trim().length > 0
    )).length
    const totalParamCount = endpoints.reduce((sum, endpoint) => sum + endpoint.params.length, 0)
    this.logger.log(
      `Interactive API explorer built for repo=${repo.id}, endpoints=${endpoints.length}, segments=${segments.length}`
    )

    return {
      endpoints,
      filters: {
        frameworks: requestedFrameworks.length > 0 ? requestedFrameworks : undefined,
        methods: requestedMethods.length > 0 ? requestedMethods : undefined,
        search: search || undefined
      },
      generatedAt: new Date().toISOString(),
      metadata: {
        avgParamsPerEndpoint: this.toRatio(totalParamCount, endpoints.length),
        endpointCount: endpoints.length,
        endpointDistributionByFramework,
        endpointDistributionByMethod,
        endpointsWithRequestBodyModel,
        endpointsWithSourceSnippet,
        frameworks,
        moduleCount: modules.length,
        modules,
        repoId: repo.id,
        repoName: repo.name,
        requestBodyModelCoverage: this.toRatio(endpointsWithRequestBodyModel, endpoints.length),
        segmentCount: segments.length,
        sourceSnippetCoverage: this.toRatio(endpointsWithSourceSnippet, endpoints.length)
      }
    }
  }

  async getRepoOpenApiSpec(
    userId: number,
    repoId: number,
    query: ApiExplorerQuery
  ): Promise<RepoOpenApiDocument> {
    const interactiveApi = await this.getRepoInteractiveApi(userId, repoId, query)
    const schemaRegistry = await this.buildOpenApiSchemaRegistry(repoId)
    const staticSpec = this.openApiBuilder.buildStaticSpec(interactiveApi, schemaRegistry)

    const runtimeBaseUrl = this.parseRuntimeBaseUrl(query.runtimeBaseUrl)
    if (!runtimeBaseUrl) {
      return staticSpec
    }

    const runtimeResult = await this.tryFetchRuntimeOpenApiDocument(runtimeBaseUrl)
    if (!runtimeResult) {
      return staticSpec
    }

    return this.openApiBuilder.mergeRuntimeOpenApiWithStatic(
      runtimeResult.spec,
      staticSpec,
      runtimeResult.resolvedUrl
    )
  }

  async listRunnerAuthPresets(userId: number, repoId: number): Promise<RepoApiRunnerAuthPreset[]> {
    await this.assertRepoOwnership(userId, repoId)
    return await this.apiRunnerService.listRunnerAuthPresets(userId, repoId)
  }

  async listRunnerCollections(userId: number, repoId: number): Promise<RepoApiRunnerCollection[]> {
    await this.assertRepoOwnership(userId, repoId)
    return await this.apiRunnerService.listRunnerCollections(userId, repoId)
  }

  async runApiRequest(
    userId: number,
    repoId: number,
    input: RepoApiRunnerRequest
  ): Promise<RepoApiRunnerResponse> {
    await this.assertRepoOwnership(userId, repoId)
    return await this.apiRunnerService.runApiRequest(input)
  }

  async saveRunnerAuthPreset(
    userId: number,
    repoId: number,
    input: RepoApiRunnerSaveAuthPresetRequest
  ): Promise<RepoApiRunnerAuthPreset> {
    await this.assertRepoOwnership(userId, repoId)
    return await this.apiRunnerService.saveRunnerAuthPreset(userId, repoId, input)
  }

  async saveRunnerCollection(
    userId: number,
    repoId: number,
    input: RepoApiRunnerSaveCollectionRequest
  ): Promise<RepoApiRunnerCollection> {
    await this.assertRepoOwnership(userId, repoId)
    return await this.apiRunnerService.saveRunnerCollection(userId, repoId, input)
  }

  private assertMethod(value: string): null | RepoApiHttpMethod {
    const method = value.trim().toUpperCase() as RepoApiHttpMethod
    if (!SUPPORTED_METHODS.includes(method)) {
      return null
    }

    return method
  }

  private async assertRepoOwnership(userId: number, repoId: number): Promise<RepoOwnership> {
    const [repo] = await this.dbService.dbClient.select({
      id: repos.id,
      name: repos.name
    })
      .from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) {
      throw new NotFoundException('Repository not found')
    }

    return repo
  }

  private buildCanonicalFiles(segments: IngestSegmentPayload[]) {
    const files = new Map<string, CanonicalFile>()

    for (const segment of segments) {
      const normalizedPath = this.normalizeFilePath(segment.file_path)
      if (!normalizedPath) {
        continue
      }

      const file = files.get(normalizedPath) ?? {
        content: '',
        fileExt: this.safeString(segment.file_ext) ?? pathPosix.extname(normalizedPath),
        filePath: normalizedPath,
        language: this.safeString(segment.language) ?? 'unknown',
        segmentCount: 0
      }

      const content = this.safeString(segment.content)
      if (
        content
        && file.segmentCount < MAX_SEGMENTS_PER_FILE
        && file.content.length < MAX_CONTENT_PER_FILE
      ) {
        const remaining = MAX_CONTENT_PER_FILE - file.content.length
        if (remaining > 0) {
          const nextChunk = content.slice(0, remaining)
          file.content = file.content.length > 0
            ? `${file.content}\n${nextChunk}`
            : nextChunk
        }
      }

      file.segmentCount += 1
      files.set(normalizedPath, file)
    }

    return files
  }

  private async buildOpenApiSchemaRegistry(repoId: number): Promise<Record<string, RepoOpenApiSchema>> {
    const segments = await this.fetchRepoSegmentsFromQdrant(repoId)
    const files = this.buildCanonicalFiles(segments)
    const schemaRegistry: Record<string, RepoOpenApiSchema> = {}

    for (const file of files.values()) {
      const nextSchemas = this.endpointDetector.extractSchemasFromFile(file)
      for (const [name, schema] of Object.entries(nextSchemas)) {
        if (!schemaRegistry[name]) {
          schemaRegistry[name] = schema
        }
      }
    }

    return schemaRegistry
  }

  private countEndpointsByFramework(endpoints: RepoApiEndpoint[]) {
    const counts: Partial<Record<RepoApiFramework, number>> = {}
    for (const endpoint of endpoints) {
      counts[endpoint.framework] = (counts[endpoint.framework] ?? 0) + 1
    }

    return counts
  }

  private countEndpointsByMethod(endpoints: RepoApiEndpoint[]) {
    const counts: Partial<Record<RepoApiHttpMethod, number>> = {}
    for (const endpoint of endpoints) {
      counts[endpoint.method] = (counts[endpoint.method] ?? 0) + 1
    }

    return counts
  }

  private async fetchRepoSegmentsFromQdrant(repoId: number): Promise<IngestSegmentPayload[]> {
    const payloads: IngestSegmentPayload[] = []
    let offset: number | string | undefined = undefined
    const collectionName = env.qdrantEmbeddingsCollectionName

    try {
      while (true) {
        const result = await this.qdrantService.scroll(collectionName, {
          filter: {
            must: [
              {
                key: 'repo_id',
                match: {
                  value: repoId
                }
              }
            ]
          },
          limit: 256,
          offset,
          withPayload: true,
          withVector: false
        }) as {
          next_page_offset?: unknown
          points?: Array<{ payload?: Record<string, unknown> }>
        }

        const points = Array.isArray(result?.points) ? result.points : []
        for (const point of points) {
          if (!point?.payload || typeof point.payload !== 'object') {
            continue
          }

          const payload = point.payload as IngestSegmentPayload
          if (
            typeof payload.message_type === 'string'
            && payload.message_type !== 'ingest.batch.ready'
          ) {
            continue
          }

          const filePath = this.normalizeFilePath(payload.file_path)
          if (!filePath) {
            continue
          }

          payloads.push({
            ...payload,
            file_path: filePath
          })
        }

        if (result?.next_page_offset === undefined || result?.next_page_offset === null) {
          break
        }

        if (typeof result.next_page_offset === 'number' || typeof result.next_page_offset === 'string') {
          offset = result.next_page_offset
        } else {
          break
        }
      }
    } catch (error) {
      const safeError = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to load repo segments from Qdrant for repo=${repoId}: ${safeError}`)
      return []
    }

    return payloads
  }

  private isAllowedRunnerTarget(urlString: string) {
    let parsed: URL
    try {
      parsed = new URL(urlString)
    } catch {
      return false
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false
    }

    const hostname = parsed.hostname.toLowerCase()
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      return true
    }

    if (hostname.endsWith('.local') || hostname.endsWith('.lan')) {
      return true
    }

    if (!hostname.includes('.')) {
      // Single-label hostnames on local network (for example: raspberrypi).
      return true
    }

    return this.isPrivateIpv4Host(hostname)
  }

  private isPrivateIpv4Host(hostname: string) {
    const octets = hostname.split('.').map(value => Number.parseInt(value, 10))
    if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
      return false
    }

    const [first, second] = octets
    if (first === 10) {
      return true
    }

    if (first === 192 && second === 168) {
      return true
    }

    if (first === 172 && second >= 16 && second <= 31) {
      return true
    }

    return false
  }

  private normalizeFilePath(filePath: unknown) {
    if (typeof filePath !== 'string') {
      return null
    }

    const normalized = filePath
      .trim()
      .replaceAll('\\', '/')
      .replace(/^\.\/+/, '')
      .replace(/\/{2,}/g, '/')

    if (!normalized) {
      return null
    }

    return normalized
  }

  private parseFrameworks(frameworks?: string) {
    if (!frameworks) {
      return [] as RepoApiFramework[]
    }

    const values = frameworks
      .split(',')
      .map(value => value.trim().toLowerCase() as RepoApiFramework)
      .filter(value => SUPPORTED_FRAMEWORKS.includes(value))

    return Array.from(new Set(values))
  }

  private parseMethods(methods?: string) {
    if (!methods) {
      return [] as RepoApiHttpMethod[]
    }

    const values = methods
      .split(',')
      .map(value => this.assertMethod(value))
      .filter((value): value is RepoApiHttpMethod => value !== null)

    return Array.from(new Set(values))
  }

  private parseRuntimeBaseUrl(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
      return null
    }

    let parsed: URL
    try {
      parsed = new URL(value.trim())
    } catch {
      throw new BadRequestException('runtimeBaseUrl is invalid')
    }

    const normalized = parsed.toString()
    if (!this.isAllowedRunnerTarget(normalized)) {
      throw new BadRequestException(
        'runtimeBaseUrl must be localhost or private LAN address (10.x, 172.16-31.x, 192.168.x)'
      )
    }

    return normalized
  }

  private parseSearch(search?: string) {
    if (!search) {
      return ''
    }

    return search.trim().toLowerCase()
  }

  private safeString(value: unknown) {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private toRatio(value: number, total: number) {
    if (total <= 0) {
      return 0
    }

    return Number((value / total).toFixed(4))
  }

  private async tryFetchRuntimeOpenApiDocument(runtimeBaseUrl: string): Promise<null | {
    resolvedUrl: string
    spec: RepoOpenApiDocument
  }> {
    for (const candidatePath of RUNTIME_OPENAPI_CANDIDATE_PATHS) {
      const candidateUrl = new URL(candidatePath, runtimeBaseUrl).toString()
      try {
        const response = await this.httpClient.request<unknown>({
          maxContentLength: RUNNER_MAX_RESPONSE_BYTES,
          method: 'GET',
          timeout: RUNTIME_OPENAPI_TIMEOUT_MS,
          url: candidateUrl,
          validateStatus: status => status >= 200 && status < 300
        })

        const normalized = this.openApiBuilder.normalizeRuntimeOpenApiDocument(response.data)
        if (normalized) {
          this.logger.log(`Using runtime OpenAPI from ${candidateUrl}`)
          return {
            resolvedUrl: candidateUrl,
            spec: normalized
          }
        }
      } catch {
        continue
      }
    }

    this.logger.warn(`Runtime OpenAPI unavailable for base URL ${runtimeBaseUrl}, using static fallback`)
    return null
  }

  private uniqueParams(params: RepoApiEndpointParameter[]) {
    const unique = new Map<string, RepoApiEndpointParameter>()
    for (const param of params) {
      unique.set(`${param.location}:${param.name}`, param)
    }

    return [...unique.values()].sort((a, b) => {
      const byLocation = a.location.localeCompare(b.location)
      if (byLocation !== 0) {
        return byLocation
      }

      return a.name.localeCompare(b.name)
    })
  }

  private upsertEndpoint(endpointsByKey: Map<string, RepoApiEndpoint>, endpoint: RepoApiEndpoint) {
    const key = `${endpoint.framework}:${endpoint.method}:${endpoint.path}:${endpoint.filePath}`
    const existing = endpointsByKey.get(key)

    if (!existing) {
      endpointsByKey.set(key, endpoint)
      return
    }

    const mergedParams = this.uniqueParams([...existing.params, ...endpoint.params])
    endpointsByKey.set(key, {
      ...existing,
      moduleName: existing.moduleName ?? endpoint.moduleName,
      params: mergedParams,
      requestBodyTypeName: existing.requestBodyTypeName ?? endpoint.requestBodyTypeName,
      sourceLineStart: existing.sourceLineStart ?? endpoint.sourceLineStart,
      sourceSnippet: existing.sourceSnippet ?? endpoint.sourceSnippet,
      symbolName: existing.symbolName ?? endpoint.symbolName
    })
  }
}
