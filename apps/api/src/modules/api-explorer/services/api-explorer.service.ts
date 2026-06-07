import { posix as pathPosix } from 'node:path'

import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'
import { Nullable, Undefinable } from '@workspace/codepath-common'
import type {
  RepoApiEndpoint,
  RepoApiEndpointParameter,
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
import { RepoApiFramework, RepoApiHttpMethod, RepoApiParameterLocation } from '@workspace/codepath-common/api-explorer'
import type { AxiosInstance } from 'axios'

import { env } from '../../../config/env'
import { assertRepoOwnership, isAllowedRunnerTarget, normalizeHttpPath, uniqueParams } from '../../../utils/helpers'
import { DbService } from '../../db/services/db.service'
import { HTTP_CLIENT } from '../../http-client/http-client.tokens'
import { QdrantService } from '../../qdrant/services/qdrant.service'
import { OpenApiDocumentBuilder } from '../builders/openapi-document.builder'
import { ApiEndpointDetector } from '../detectors/api-endpoint.detector'
import type {
  ApiExplorerIngestSegmentPayload as IngestSegmentPayload,
  ApiExplorerQuery,
  CanonicalApiFile as CanonicalFile
} from '../types/api-explorer-internal.types'
import { ApiRunnerService } from './api-runner.service'

const MAX_CONTENT_PER_FILE = 220_000
const MAX_SEGMENTS_PER_FILE = 400

const SUPPORTED_FRAMEWORKS: RepoApiFramework[] = [
  RepoApiFramework.DJANGO,
  RepoApiFramework.EXPRESS,
  RepoApiFramework.FASTAPI,
  RepoApiFramework.FLASK,
  RepoApiFramework.NESTJS,
  RepoApiFramework.UNKNOWN
]

const SUPPORTED_METHODS: RepoApiHttpMethod[] = [
  RepoApiHttpMethod.DELETE,
  RepoApiHttpMethod.GET,
  RepoApiHttpMethod.HEAD,
  RepoApiHttpMethod.OPTIONS,
  RepoApiHttpMethod.PATCH,
  RepoApiHttpMethod.POST,
  RepoApiHttpMethod.PUT
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
    await assertRepoOwnership(this.dbService, userId, repoId)
    return await this.apiRunnerService.deleteRunnerAuthPreset(userId, repoId, presetId)
  }

  async deleteRunnerCollection(userId: number, repoId: number, collectionId: number) {
    await assertRepoOwnership(this.dbService, userId, repoId)
    return await this.apiRunnerService.deleteRunnerCollection(userId, repoId, collectionId)
  }

  async getRepoInteractiveApi(userId: number, repoId: number, query: ApiExplorerQuery): Promise<RepoInteractiveApi> {
    const repo = await assertRepoOwnership(this.dbService, userId, repoId)
    const requestedFrameworks = this.parseFrameworks(query.frameworks)
    const requestedMethods = this.parseMethods(query.methods)
    const search = this.parseSearch(query.search)

    const segments = await this.fetchRepoSegmentsFromQdrant(repo.id)
    const files = this.buildCanonicalFiles(segments)
    const endpointsByKey = new Map<string, RepoApiEndpoint>()

    for (const segment of segments) {
      const endpoint = this.buildEndpointFromSemanticSegment(segment)

      if (endpoint) this.upsertEndpoint(endpointsByKey, endpoint)
    }

    for (const file of files.values()) {
      const fileEndpoints = this.endpointDetector.detectEndpointsForFile(file)

      for (const endpoint of fileEndpoints) {
        this.upsertEndpoint(endpointsByKey, endpoint)
      }
    }

    let endpoints = [...endpointsByKey.values()]

    if (requestedFrameworks.length > 0) endpoints = endpoints.filter(endpoint => requestedFrameworks.includes(endpoint.framework))
    if (requestedMethods.length > 0) endpoints = endpoints.filter(endpoint => requestedMethods.includes(endpoint.method))

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

      if (byModule !== 0) return byModule

      const byMethod = a.method.localeCompare(b.method)

      if (byMethod !== 0) return byMethod

      const byPath = a.path.localeCompare(b.path)

      if (byPath !== 0) return byPath

      const byFramework = a.framework.localeCompare(b.framework)

      if (byFramework !== 0) return byFramework

      return a.filePath.localeCompare(b.filePath)
    })

    const frameworks = Array.from(new Set(endpoints.map(endpoint => endpoint.framework))).sort()
    const modules = Array.from(
      new Set(endpoints.map(endpoint => endpoint.moduleName?.trim()).filter((value): value is string => Boolean(value)))
    ).sort((a, b) => a.localeCompare(b))
    const endpointDistributionByFramework = this.countEndpointsByFramework(endpoints)
    const endpointDistributionByMethod = this.countEndpointsByMethod(endpoints)
    const endpointsWithRequestBodyModel = endpoints.filter(endpoint => typeof endpoint.requestBodyTypeName === 'string' && endpoint.requestBodyTypeName.trim().length > 0).length
    const endpointsWithSourceSnippet = endpoints.filter(endpoint => typeof endpoint.sourceSnippet === 'string' && endpoint.sourceSnippet.trim().length > 0).length
    const totalParamCount = endpoints.reduce((sum, endpoint) => sum + endpoint.params.length, 0)

    this.logger.log(`Interactive API explorer built for repo=${repo.id}, endpoints=${endpoints.length}, segments=${segments.length}`)

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

  async getRepoOpenApiSpec(userId: number, repoId: number, query: ApiExplorerQuery): Promise<RepoOpenApiDocument> {
    const interactiveApi = await this.getRepoInteractiveApi(userId, repoId, query)
    const schemaRegistry = await this.buildOpenApiSchemaRegistry(repoId)
    const staticSpec = this.openApiBuilder.buildStaticSpec(interactiveApi, schemaRegistry)

    const runtimeBaseUrl = this.parseRuntimeBaseUrl(query.runtimeBaseUrl)

    if (!runtimeBaseUrl) return staticSpec

    const runtimeResult = await this.tryFetchRuntimeOpenApiDocument(runtimeBaseUrl)

    if (!runtimeResult) return staticSpec

    return this.openApiBuilder.mergeRuntimeOpenApiWithStatic(runtimeResult.spec, staticSpec, runtimeResult.resolvedUrl)
  }

  async listRunnerAuthPresets(userId: number, repoId: number): Promise<RepoApiRunnerAuthPreset[]> {
    await assertRepoOwnership(this.dbService, userId, repoId)
    return await this.apiRunnerService.listRunnerAuthPresets(userId, repoId)
  }

  async listRunnerCollections(userId: number, repoId: number): Promise<RepoApiRunnerCollection[]> {
    await assertRepoOwnership(this.dbService, userId, repoId)
    return await this.apiRunnerService.listRunnerCollections(userId, repoId)
  }

  async runApiRequest(userId: number, repoId: number, input: RepoApiRunnerRequest): Promise<RepoApiRunnerResponse> {
    await assertRepoOwnership(this.dbService, userId, repoId)
    return await this.apiRunnerService.runApiRequest(input)
  }

  async saveRunnerAuthPreset(userId: number, repoId: number, input: RepoApiRunnerSaveAuthPresetRequest): Promise<RepoApiRunnerAuthPreset> {
    await assertRepoOwnership(this.dbService, userId, repoId)
    return await this.apiRunnerService.saveRunnerAuthPreset(userId, repoId, input)
  }

  async saveRunnerCollection(userId: number, repoId: number, input: RepoApiRunnerSaveCollectionRequest): Promise<RepoApiRunnerCollection> {
    await assertRepoOwnership(this.dbService, userId, repoId)
    return await this.apiRunnerService.saveRunnerCollection(userId, repoId, input)
  }

  private assertFramework(value: string): null | RepoApiFramework {
    const normalized = value.trim().toLowerCase()
    return SUPPORTED_FRAMEWORKS.find(framework => framework === normalized) ?? null
  }

  private assertMethod(value: string): null | RepoApiHttpMethod {
    const method = value.trim().toUpperCase() as RepoApiHttpMethod

    if (!SUPPORTED_METHODS.includes(method)) return null

    return method
  }

  private buildCanonicalFiles(segments: IngestSegmentPayload[]): Map<string, CanonicalFile> {
    const files = new Map<string, CanonicalFile>()

    for (const segment of segments) {
      const normalizedPath = this.normalizeFilePath(segment.file_path)

      if (!normalizedPath) continue

      const file = files.get(normalizedPath) ?? {
        content: '',
        fileExt: this.safeString(segment.file_ext) ?? pathPosix.extname(normalizedPath),
        filePath: normalizedPath,
        language: this.safeString(segment.language) ?? 'unknown',
        segmentCount: 0
      }

      const content = this.safeString(segment.content)

      if (content && file.segmentCount < MAX_SEGMENTS_PER_FILE && file.content.length < MAX_CONTENT_PER_FILE) {
        const remaining = MAX_CONTENT_PER_FILE - file.content.length

        if (remaining > 0) {
          const nextChunk = content.slice(0, remaining)

          file.content = file.content.length > 0 ? `${file.content}\n${nextChunk}` : nextChunk
        }
      }

      file.segmentCount += 1
      files.set(normalizedPath, file)
    }

    return files
  }

  private buildEndpointFromSemanticSegment(segment: IngestSegmentPayload): Nullable<RepoApiEndpoint> {
    if (segment.symbol_kind !== 'http_endpoint') return null

    const filePath = this.normalizeFilePath(segment.file_path)
    const method = this.assertMethod(this.safeString(segment.http_method) ?? '')
    const routePath = this.safeString(segment.route_path)

    if (!filePath || !method || !routePath) return null

    const params = Array.isArray(segment.params)
      ? segment.params.map(param => this.toEndpointParam(param)).filter((param): param is RepoApiEndpointParameter => param !== null)
      : []

    return {
      filePath,
      framework: this.inferFrameworkFromSemanticSegment(segment),
      id: `semantic:${method}:${filePath}:${routePath}:${this.safeString(segment.symbol_name) ?? ''}`,
      method,
      moduleName: this.inferModuleName(filePath),
      params: uniqueParams(params),
      path: normalizeHttpPath(routePath),
      requestBodyTypeName: this.extractRequestBodyTypeFromParams(segment.params),
      sourceLineStart: typeof segment.start_line === 'number' ? segment.start_line : undefined,
      sourceSnippet: this.safeString(segment.content) ?? undefined,
      symbolName: this.safeString(segment.symbol_name) ?? undefined
    }
  }

  private async buildOpenApiSchemaRegistry(repoId: number): Promise<Record<string, RepoOpenApiSchema>> {
    const segments = await this.fetchRepoSegmentsFromQdrant(repoId)
    const files = this.buildCanonicalFiles(segments)
    const schemaRegistry: Record<string, RepoOpenApiSchema> = {}

    for (const file of files.values()) {
      const nextSchemas = this.endpointDetector.extractSchemasFromFile(file)
      for (const [name, schema] of Object.entries(nextSchemas)) {
        if (!schemaRegistry[name]) schemaRegistry[name] = schema
      }
    }

    return schemaRegistry
  }

  private countEndpointsByFramework(endpoints: RepoApiEndpoint[]): Partial<Record<RepoApiFramework, number>> {
    const counts: Partial<Record<RepoApiFramework, number>> = {}
    for (const endpoint of endpoints) {
      counts[endpoint.framework] = (counts[endpoint.framework] ?? 0) + 1
    }

    return counts
  }

  private countEndpointsByMethod(endpoints: RepoApiEndpoint[]): Partial<Record<RepoApiHttpMethod, number>> {
    const counts: Partial<Record<RepoApiHttpMethod, number>> = {}
    for (const endpoint of endpoints) {
      counts[endpoint.method] = (counts[endpoint.method] ?? 0) + 1
    }

    return counts
  }

  private extractRequestBodyTypeFromParams(params?: string[]): Undefinable<string> {
    if (!Array.isArray(params)) return undefined

    for (const param of params) {
      const parsed = this.parseParamSignature(param)

      if (!parsed || parsed.decorator !== 'Body') continue

      const typeName = this.extractTypeName(parsed.typeName)

      if (typeName) return typeName
    }

    return undefined
  }

  private extractTypeName(value?: string): Undefinable<string> {
    if (!value) return undefined

    const normalized = value.trim()
      .split(/[\s<>\[\],|]/)[0]
      ?.replace(/^.*\./, '')
      ?.replace(/[^A-Za-z0-9_]/g, '')

    if (!normalized || ['Array', 'Record', 'boolean', 'number', 'object', 'string', 'unknown', 'void'].includes(normalized)) return undefined

    return normalized
  }

  private async fetchRepoSegmentsFromQdrant(repoId: number): Promise<IngestSegmentPayload[]> {
    const payloads: IngestSegmentPayload[] = []
    let offset: Undefinable<number | string> = undefined
    const collectionName = env.qdrantEmbeddingsCollectionName

    try {
      while (true) {
        const result = await this.qdrantService.scroll(collectionName, {
          filter: { must: [{ key: 'repo_id', match: { value: repoId } }] },
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
          if (!point?.payload || typeof point.payload !== 'object') continue

          const payload = point.payload as IngestSegmentPayload

          if (typeof payload.message_type === 'string' && payload.message_type !== 'ingest.batch.ready') continue

          const filePath = this.normalizeFilePath(payload.file_path)

          if (!filePath) continue

          payloads.push({ ...payload, file_path: filePath })
        }

        if (result?.next_page_offset === undefined || result?.next_page_offset === null) break

        if (typeof result.next_page_offset === 'number' || typeof result.next_page_offset === 'string') offset = result.next_page_offset
        else break
      }
    } catch (error) {
      const safeError = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to load repo segments from Qdrant for repo=${repoId}: ${safeError}`)
      return []
    }

    return payloads
  }

  private inferFrameworkFromSemanticSegment(segment: IngestSegmentPayload): RepoApiFramework {
    const language = this.safeString(segment.language)?.toLowerCase() ?? ''
    const filePath = this.safeString(segment.file_path)?.toLowerCase() ?? ''

    if (language.includes('typescript') || filePath.endsWith('.ts')) return RepoApiFramework.NESTJS
    if (language.includes('python') || filePath.endsWith('.py')) return RepoApiFramework.FASTAPI

    return RepoApiFramework.UNKNOWN
  }

  private inferModuleName(filePath: string): string {
    const segments = filePath.split('/').filter(Boolean)
    const lowercase = segments.map(segment => segment.toLowerCase())

    for (const marker of ['modules', 'controllers', 'controller', 'routes', 'routers', 'api']) {
      const markerIndex = lowercase.lastIndexOf(marker)
      const nextSegment = segments[markerIndex + 1]

      if (markerIndex >= 0 && nextSegment && !nextSegment.includes('.')) return this.normalizeModuleSegment(nextSegment)
    }

    const fileName = segments[segments.length - 1] ?? 'api'
    return this.normalizeModuleSegment(fileName)
  }

  private normalizeFilePath(filePath: unknown): Nullable<string> {
    if (typeof filePath !== 'string') return null

    const normalized = filePath.trim()
      .replaceAll('\\', '/')
      .replace(/^\.\/+/, '')
      .replace(/\/{2,}/g, '/')

    if (!normalized) return null

    return normalized
  }

  private normalizeModuleSegment(segment: string): string {
    const cleaned = segment
      .replace(/\.[^.]+$/, '')
      .replace(/(?:\.|_)?(controller|controllers|route|routes|router|routers|handler|handlers)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()

    return cleaned.length > 0 ? cleaned : segment
  }

  private parseFrameworks(frameworks?: string): RepoApiFramework[] {
    if (!frameworks) return [] as RepoApiFramework[]

    const values = frameworks
      .split(',')
      .map(value => this.assertFramework(value))
      .filter((value): value is RepoApiFramework => value !== null)

    return Array.from(new Set(values))
  }

  private parseMethods(methods?: string): RepoApiHttpMethod[] {
    if (!methods) return [] as RepoApiHttpMethod[]

    const values = methods
      .split(',')
      .map(value => this.assertMethod(value))
      .filter((value): value is RepoApiHttpMethod => value !== null)

    return Array.from(new Set(values))
  }

  private parseParamSignature(param: string): Nullable<{ decorator?: string, name: string, typeName?: string }> {
    const trimmed = param.trim()

    if (!trimmed) return null

    const decorator = trimmed.match(/@([A-Za-z_][A-Za-z0-9_]*)\b/)?.[1]
    const withoutDecorator = trimmed.replace(/@[A-Za-z_][A-Za-z0-9_]*\s*\([^)]*\)\s*/, '').trim()
    const match = withoutDecorator.match(/(?:readonly\s+)?([A-Za-z_][A-Za-z0-9_]*)\??\s*:\s*([^=,]+)/)

    if (!match?.[1]) return null

    return {
      decorator,
      name: match[1],
      typeName: match[2]?.trim()
    }
  }

  private parseRuntimeBaseUrl(value: unknown): Nullable<string> {
    if (typeof value !== 'string' || !value.trim()) return null

    let parsed: URL

    try {
      parsed = new URL(value.trim())
    } catch {
      throw new BadRequestException('runtimeBaseUrl is invalid')
    }

    const normalized = parsed.toString()

    if (!isAllowedRunnerTarget(normalized)) throw new BadRequestException('runtimeBaseUrl must be localhost or private LAN address (10.x, 172.16-31.x, 192.168.x)')

    return normalized
  }

  private parseSearch(search?: string): string {
    if (!search) return ''

    return search.trim().toLowerCase()
  }

  private safeString(value: unknown): Nullable<string> {
    if (typeof value !== 'string') return null

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private toEndpointParam(param: string): Nullable<RepoApiEndpointParameter> {
    const parsed = this.parseParamSignature(param)

    if (!parsed) return null

    const location = parsed.decorator === 'Param'
      ? RepoApiParameterLocation.PATH
      : parsed.decorator === 'Query'
        ? RepoApiParameterLocation.QUERY
        : parsed.decorator === 'Headers'
          ? RepoApiParameterLocation.HEADER
          : parsed.decorator === 'Body'
            ? RepoApiParameterLocation.BODY
            : null

    if (!location) return null

    return {
      location,
      name: parsed.name,
      required: location === RepoApiParameterLocation.PATH
    }
  }

  private toRatio(value: number, total: number): number {
    if (total <= 0) return 0

    return Number((value / total).toFixed(4))
  }

  private async tryFetchRuntimeOpenApiDocument(runtimeBaseUrl: string): Promise<Nullable<{
    resolvedUrl: string
    spec: RepoOpenApiDocument
  }>> {
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
          return { resolvedUrl: candidateUrl, spec: normalized }
        }
      } catch {
        // do nothing
      }
    }

    this.logger.warn(`Runtime OpenAPI unavailable for base URL ${runtimeBaseUrl}, using static fallback`)
    return null
  }

  private upsertEndpoint(endpointsByKey: Map<string, RepoApiEndpoint>, endpoint: RepoApiEndpoint) {
    const key = `${endpoint.framework}:${endpoint.method}:${endpoint.path}:${endpoint.filePath}`
    const existing = endpointsByKey.get(key)

    if (!existing) {
      endpointsByKey.set(key, endpoint)
      return
    }

    const mergedParams = uniqueParams([...existing.params, ...endpoint.params])
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
