import { posix as pathPosix } from 'node:path'

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type {
  RepoApiEndpoint,
  RepoApiEndpointParameter,
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoApiRunnerAuthConfig,
  RepoApiRunnerAuthMode,
  RepoApiRunnerAuthPreset,
  RepoApiRunnerCollection,
  RepoApiRunnerCollectionConfig,
  RepoApiRunnerRequest,
  RepoApiRunnerResponse,
  RepoApiRunnerSaveAuthPresetRequest,
  RepoApiRunnerSaveCollectionRequest,
  RepoInteractiveApi,
  RepoOpenApiDocument,
  RepoOpenApiOperation,
  RepoOpenApiOperationMethod,
  RepoOpenApiParameter,
  RepoOpenApiSchema,
  RepoOpenApiSourceMetadata
} from '@workspace/codepath-common/api-explorer'
import axios from 'axios'
import { and, desc, eq } from 'drizzle-orm'

import { env } from '../../config/env'
import { DbService } from '../db/db.service'
import { apiRunnerAuthPresets, apiRunnerCollections, repos } from '../db/schema'
import { QdrantService } from '../qdrant/qdrant.service'

interface ApiExplorerQuery {
  frameworks?: string
  methods?: string
  runtimeBaseUrl?: string
  search?: string
}

interface CanonicalFile {
  content: string
  fileExt: string
  filePath: string
  language: string
  segmentCount: number
}

interface IngestSegmentPayload {
  content?: string
  file_ext?: string
  file_path?: string
  language?: string
  message_type?: string
}

interface RepoOwnership {
  id: number
  name: string
}

interface SourceContext {
  lineStart: number
  snippet: string
}

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

const METHOD_TO_OPENAPI: Record<RepoApiHttpMethod, RepoOpenApiOperationMethod> = {
  DELETE: 'delete',
  GET: 'get',
  HEAD: 'head',
  OPTIONS: 'options',
  PATCH: 'patch',
  POST: 'post',
  PUT: 'put'
}

function parsePathParamNames(path: string) {
  const names = new Set<string>()
  for (const match of path.matchAll(/:([A-Za-z0-9_]+)/g)) {
    if (match[1]) {
      names.add(match[1])
    }
  }
  for (const match of path.matchAll(/\{([A-Za-z0-9_]+)(?::[^}]+)?}/g)) {
    if (match[1]) {
      names.add(match[1])
    }
  }
  for (const match of path.matchAll(/<(?:(?:[A-Za-z0-9_]+):)?([A-Za-z0-9_]+)>/g)) {
    if (match[1]) {
      names.add(match[1])
    }
  }

  return [...names]
}

const RUNNER_DEFAULT_TIMEOUT_MS = 10_000
const RUNNER_MAX_TIMEOUT_MS = 30_000
const RUNNER_MAX_RESPONSE_BYTES = 1_000_000
const RUNTIME_OPENAPI_TIMEOUT_MS = 6_000
const RUNNER_COLLECTION_NAME_MAX_LENGTH = 120
const RUNNER_AUTH_PRESET_NAME_MAX_LENGTH = 120
const RUNNER_AUTH_MODES: RepoApiRunnerAuthMode[] = ['none', 'bearer', 'basic', 'apiKey']
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
  private readonly logger = new Logger(ApiExplorerService.name)

  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService
  ) {}

  async deleteRunnerAuthPreset(userId: number, repoId: number, presetId: number) {
    await this.assertRepoOwnership(userId, repoId)

    const [deleted] = await this.dbService.dbClient.delete(apiRunnerAuthPresets)
      .where(and(
        eq(apiRunnerAuthPresets.id, presetId),
        eq(apiRunnerAuthPresets.repoId, repoId),
        eq(apiRunnerAuthPresets.userId, userId)
      ))
      .returning({ id: apiRunnerAuthPresets.id })

    if (!deleted) {
      throw new NotFoundException('Runner auth preset not found')
    }

    return {
      id: deleted.id,
      ok: true as const
    }
  }

  async deleteRunnerCollection(userId: number, repoId: number, collectionId: number) {
    await this.assertRepoOwnership(userId, repoId)

    const [deleted] = await this.dbService.dbClient.delete(apiRunnerCollections)
      .where(and(
        eq(apiRunnerCollections.id, collectionId),
        eq(apiRunnerCollections.repoId, repoId),
        eq(apiRunnerCollections.userId, userId)
      ))
      .returning({ id: apiRunnerCollections.id })

    if (!deleted) {
      throw new NotFoundException('Runner collection not found')
    }

    return {
      id: deleted.id,
      ok: true as const
    }
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
      const fileEndpoints = this.detectEndpointsForFile(file)
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
        endpointCount: endpoints.length,
        frameworks,
        repoId: repo.id,
        repoName: repo.name,
        segmentCount: segments.length
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
    const paths: RepoOpenApiDocument['paths'] = {}

    for (const endpoint of interactiveApi.endpoints) {
      const openApiPath = this.toOpenApiPath(endpoint.path)
      const openApiMethod = METHOD_TO_OPENAPI[endpoint.method]
      const nextOperation = this.toOpenApiOperation(endpoint, openApiPath, schemaRegistry)

      if (!paths[openApiPath]) {
        paths[openApiPath] = {}
      }

      const existing = paths[openApiPath][openApiMethod]
      if (!existing) {
        paths[openApiPath][openApiMethod] = nextOperation
        continue
      }

      const mergedSources = this.mergeOperationSources(existing, nextOperation)
      paths[openApiPath][openApiMethod] = {
        ...existing,
        'x-codepath-sources': mergedSources
      }
    }

    const tags = Array.from(
      new Set(
        interactiveApi.endpoints.map(endpoint => endpoint.moduleName || endpoint.framework)
      )
    )
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name }))

    const staticSpec: RepoOpenApiDocument = {
      components: Object.keys(schemaRegistry).length > 0
        ? {
          schemas: schemaRegistry
        }
        : undefined,
      info: {
        description: `Generated from repository segments for repo ${interactiveApi.metadata.repoId}`,
        title: `${interactiveApi.metadata.repoName} Interactive API`,
        version: '0.1.0'
      },
      openapi: '3.1.0',
      paths,
      tags
    }

    const runtimeBaseUrl = this.parseRuntimeBaseUrl(query.runtimeBaseUrl)
    if (!runtimeBaseUrl) {
      return staticSpec
    }

    const runtimeSpec = await this.tryFetchRuntimeOpenApiDocument(runtimeBaseUrl)
    if (!runtimeSpec) {
      return staticSpec
    }

    return this.mergeRuntimeOpenApiWithStatic(runtimeSpec, staticSpec)
  }

  async listRunnerAuthPresets(userId: number, repoId: number): Promise<RepoApiRunnerAuthPreset[]> {
    await this.assertRepoOwnership(userId, repoId)

    const rows = await this.dbService.dbClient.select({
      config: apiRunnerAuthPresets.config,
      createdAt: apiRunnerAuthPresets.createdAt,
      id: apiRunnerAuthPresets.id,
      name: apiRunnerAuthPresets.name,
      updatedAt: apiRunnerAuthPresets.updatedAt
    })
      .from(apiRunnerAuthPresets)
      .where(and(
        eq(apiRunnerAuthPresets.repoId, repoId),
        eq(apiRunnerAuthPresets.userId, userId)
      ))
      .orderBy(desc(apiRunnerAuthPresets.updatedAt))

    return rows.map(row => ({
      config: row.config,
      createdAt: row.createdAt,
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt
    }))
  }

  async listRunnerCollections(userId: number, repoId: number): Promise<RepoApiRunnerCollection[]> {
    await this.assertRepoOwnership(userId, repoId)

    const rows = await this.dbService.dbClient.select({
      config: apiRunnerCollections.config,
      createdAt: apiRunnerCollections.createdAt,
      id: apiRunnerCollections.id,
      name: apiRunnerCollections.name,
      updatedAt: apiRunnerCollections.updatedAt
    })
      .from(apiRunnerCollections)
      .where(and(
        eq(apiRunnerCollections.repoId, repoId),
        eq(apiRunnerCollections.userId, userId)
      ))
      .orderBy(desc(apiRunnerCollections.updatedAt))

    return rows.map(row => ({
      config: row.config,
      createdAt: row.createdAt,
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt
    }))
  }

  async runApiRequest(
    userId: number,
    repoId: number,
    input: RepoApiRunnerRequest
  ): Promise<RepoApiRunnerResponse> {
    await this.assertRepoOwnership(userId, repoId)

    const method = this.assertMethod(input.method)
    if (!method) {
      throw new BadRequestException('Unsupported HTTP method')
    }

    const targetUrl = this.normalizeRunnerUrl(input.url)
    if (!this.isAllowedRunnerTarget(targetUrl)) {
      throw new BadRequestException(
        'Target URL must be localhost or private LAN address (10.x, 172.16-31.x, 192.168.x)'
      )
    }

    const timeoutMs = this.normalizeRunnerTimeout(input.timeoutMs)
    const headers = this.normalizeRunnerHeaders(input.headers)
    if (['POST', 'PUT', 'PATCH'].includes(method) && !headers['content-type']) {
      headers['content-type'] = 'application/json'
    }
    if (!headers.accept) {
      headers.accept = 'application/json'
    }

    const startedAt = Date.now()

    try {
      const response = await axios.request<ArrayBuffer>({
        data: ['GET', 'HEAD'].includes(method) ? undefined : input.body,
        headers,
        maxBodyLength: RUNNER_MAX_RESPONSE_BYTES,
        maxContentLength: RUNNER_MAX_RESPONSE_BYTES,
        method,
        responseType: 'arraybuffer',
        timeout: timeoutMs,
        url: targetUrl,
        validateStatus: () => true
      })

      const durationMs = Date.now() - startedAt
      const responseHeaders = this.toPlainHeaders(response.headers)
      const contentType = responseHeaders['content-type'] ?? ''
      const data = this.decodeRunnerResponseBody(response.data, contentType)

      return {
        data,
        durationMs,
        headers: responseHeaders,
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        statusText: response.statusText ?? '',
        url: targetUrl
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new BadRequestException(`Runner request failed: ${message}`)
    }
  }

  async saveRunnerAuthPreset(
    userId: number,
    repoId: number,
    input: RepoApiRunnerSaveAuthPresetRequest
  ): Promise<RepoApiRunnerAuthPreset> {
    await this.assertRepoOwnership(userId, repoId)

    const name = this.normalizeName(input.name, RUNNER_AUTH_PRESET_NAME_MAX_LENGTH, 'Auth preset name')
    const config = this.normalizeRunnerAuthConfig(input.config)

    const [saved] = await this.dbService.dbClient.insert(apiRunnerAuthPresets)
      .values({
        config,
        name,
        repoId,
        userId
      })
      .onConflictDoUpdate({
        set: {
          config,
          updatedAt: new Date().toISOString()
        },
        target: [
          apiRunnerAuthPresets.repoId,
          apiRunnerAuthPresets.userId,
          apiRunnerAuthPresets.name
        ]
      })
      .returning({
        config: apiRunnerAuthPresets.config,
        createdAt: apiRunnerAuthPresets.createdAt,
        id: apiRunnerAuthPresets.id,
        name: apiRunnerAuthPresets.name,
        updatedAt: apiRunnerAuthPresets.updatedAt
      })

    return {
      config: saved.config,
      createdAt: saved.createdAt,
      id: saved.id,
      name: saved.name,
      updatedAt: saved.updatedAt
    }
  }

  async saveRunnerCollection(
    userId: number,
    repoId: number,
    input: RepoApiRunnerSaveCollectionRequest
  ): Promise<RepoApiRunnerCollection> {
    await this.assertRepoOwnership(userId, repoId)

    const name = this.normalizeCollectionName(input.name)
    const config = this.normalizeCollectionConfig(input.config)

    const [saved] = await this.dbService.dbClient.insert(apiRunnerCollections)
      .values({
        config,
        name,
        repoId,
        userId
      })
      .onConflictDoUpdate({
        set: {
          config,
          updatedAt: new Date().toISOString()
        },
        target: [
          apiRunnerCollections.repoId,
          apiRunnerCollections.userId,
          apiRunnerCollections.name
        ]
      })
      .returning({
        config: apiRunnerCollections.config,
        createdAt: apiRunnerCollections.createdAt,
        id: apiRunnerCollections.id,
        name: apiRunnerCollections.name,
        updatedAt: apiRunnerCollections.updatedAt
      })

    return {
      config: saved.config,
      createdAt: saved.createdAt,
      id: saved.id,
      name: saved.name,
      updatedAt: saved.updatedAt
    }
  }

  private addPathParameters(params: RepoApiEndpointParameter[], path: string) {
    for (const match of path.matchAll(/:([A-Za-z0-9_]+)/g)) {
      this.pushParam(params, {
        location: 'path',
        name: match[1] ?? 'param',
        required: true
      })
    }

    for (const match of path.matchAll(/\{([A-Za-z0-9_]+)(?::[^}]+)?}/g)) {
      this.pushParam(params, {
        location: 'path',
        name: match[1] ?? 'param',
        required: true
      })
    }

    for (const match of path.matchAll(/<(?:(?:[A-Za-z0-9_]+):)?([A-Za-z0-9_]+)>/g)) {
      this.pushParam(params, {
        location: 'path',
        name: match[1] ?? 'param',
        required: true
      })
    }
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
      const nextSchemas = this.extractSchemasFromFile(file)
      for (const [name, schema] of Object.entries(nextSchemas)) {
        if (!schemaRegistry[name]) {
          schemaRegistry[name] = schema
        }
      }
    }

    return schemaRegistry
  }

  private buildPathMatchCandidates(path: string) {
    const normalized = this.normalizeHttpPath(path)
    const candidates = new Set<string>([normalized])

    if (normalized.startsWith('/api/')) {
      candidates.add(this.normalizeHttpPath(normalized.slice(4)))
    } else if (normalized === '/api') {
      candidates.add('/')
    } else {
      candidates.add(this.normalizeHttpPath(`/api${normalized}`))
    }

    return [...candidates]
  }

  private createEndpoint(
    file: CanonicalFile,
    framework: RepoApiFramework,
    method: RepoApiHttpMethod,
    path: string,
    params: RepoApiEndpointParameter[],
    options?: {
      requestBodyTypeName?: string
      sourceContext?: SourceContext
      symbolName?: string
    }
  ): RepoApiEndpoint {
    return {
      filePath: file.filePath,
      framework,
      id: `${framework}:${method}:${file.filePath}:${path}`,
      method,
      moduleName: this.inferModuleName(file.filePath, framework),
      params: this.uniqueParams(params),
      path,
      requestBodyTypeName: options?.requestBodyTypeName,
      sourceLineStart: options?.sourceContext?.lineStart,
      sourceSnippet: options?.sourceContext?.snippet,
      symbolName: options?.symbolName
    }
  }

  private decodeRunnerResponseBody(data: ArrayBuffer, contentType: string) {
    const buffer = Buffer.from(data)
    const normalizedContentType = contentType.toLowerCase()

    if (normalizedContentType.includes('application/json')) {
      try {
        return JSON.parse(buffer.toString('utf8'))
      } catch {
        return buffer.toString('utf8')
      }
    }

    if (
      normalizedContentType.startsWith('text/')
      || normalizedContentType.includes('xml')
      || normalizedContentType.includes('html')
      || normalizedContentType.includes('javascript')
    ) {
      return buffer.toString('utf8')
    }

    return {
      base64: buffer.toString('base64'),
      bytes: buffer.byteLength,
      contentType: contentType || 'application/octet-stream'
    }
  }

  private detectDjangoRoutes(file: CanonicalFile) {
    if (!file.content.includes('django') || !file.content.includes('path(')) {
      return [] as RepoApiEndpoint[]
    }

    const endpoints: RepoApiEndpoint[] = []
    for (const match of file.content.matchAll(/\b(?:re_)?path\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
      const path = this.normalizeHttpPath(match[1] ?? '/')
      const params: RepoApiEndpointParameter[] = []
      const sourceContext = this.readSourceContext(file.content, match.index ?? 0, 360)
      this.addPathParameters(params, path)
      endpoints.push(this.createEndpoint(file, 'django', 'GET', path, params, { sourceContext }))
    }

    return endpoints
  }

  private detectEndpointsForFile(file: CanonicalFile) {
    const endpoints: RepoApiEndpoint[] = []
    const content = file.content.trim()
    if (!content) {
      return endpoints
    }

    endpoints.push(...this.detectNestRoutes(file))
    endpoints.push(...this.detectExpressRoutes(file))
    endpoints.push(...this.detectFastApiRoutes(file))
    endpoints.push(...this.detectFlaskRoutes(file))
    endpoints.push(...this.detectDjangoRoutes(file))
    return endpoints
  }

  private detectExpressRoutes(file: CanonicalFile) {
    if (!/\b(?:router|app)\.(?:get|post|put|patch|delete|options|head)\s*\(/i.test(file.content)) {
      return [] as RepoApiEndpoint[]
    }

    const endpoints: RepoApiEndpoint[] = []
    const pattern = /\b(?:router|app)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi

    for (const match of file.content.matchAll(pattern)) {
      const method = this.assertMethod(match[1] ?? '')
      if (!method) {
        continue
      }

      const path = this.normalizeHttpPath(match[2] ?? '/')
      const params: RepoApiEndpointParameter[] = []
      this.addPathParameters(params, path)

      const sourceContext = this.readSourceContext(file.content, match.index ?? 0, 450)
      for (const reqParamMatch of sourceContext.snippet.matchAll(/\breq\.params\.([A-Za-z0-9_]+)/g)) {
        this.pushParam(params, {
          location: 'path',
          name: reqParamMatch[1] ?? 'param',
          required: true
        })
      }

      for (const reqParamMatch of sourceContext.snippet.matchAll(/\breq\.query\.([A-Za-z0-9_]+)/g)) {
        this.pushParam(params, {
          location: 'query',
          name: reqParamMatch[1] ?? 'query',
          required: false
        })
      }

      for (const reqParamMatch of sourceContext.snippet.matchAll(/\breq\.body\.([A-Za-z0-9_]+)/g)) {
        this.pushParam(params, {
          location: 'body',
          name: reqParamMatch[1] ?? 'body',
          required: false
        })
      }

      endpoints.push(this.createEndpoint(file, 'express', method, path, params, { sourceContext }))
    }

    return endpoints
  }

  private detectFastApiRoutes(file: CanonicalFile) {
    if (!/@[A-Za-z_][A-Za-z0-9_]*\.(?:get|post|put|patch|delete|options|head)\s*\(/i.test(file.content)) {
      return [] as RepoApiEndpoint[]
    }

    const routerPrefixes = new Map<string, string>()
    for (const match of file.content.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*APIRouter\(([\s\S]*?)\)/g)) {
      const routerName = match[1] ?? ''
      const args = match[2] ?? ''
      const prefixMatch = args.match(/\bprefix\s*=\s*['"`]([^'"`]+)['"`]/)
      if (routerName && prefixMatch?.[1]) {
        routerPrefixes.set(routerName, this.normalizeHttpPath(prefixMatch[1]))
      }
    }

    const endpoints: RepoApiEndpoint[] = []
    const pattern = /@([A-Za-z_][A-Za-z0-9_]*)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi

    for (const match of file.content.matchAll(pattern)) {
      const routeOwner = (match[1] ?? '').trim()
      const method = this.assertMethod(match[2] ?? '')
      if (!method) {
        continue
      }

      const rawPath = match[3] ?? '/'
      const prefix = routeOwner === 'app' ? '/' : (routerPrefixes.get(routeOwner) ?? '/')
      const path = this.joinHttpPath(prefix, rawPath)
      const params: RepoApiEndpointParameter[] = []
      this.addPathParameters(params, path)

      const sourceContext = this.readSourceContext(file.content, match.index ?? 0, 500)
      for (const paramMatch of sourceContext.snippet.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[^=,\n)]+\s*=\s*(Query|Path|Body|Header)\(/g)) {
        const locationToken = (paramMatch[2] ?? '').toLowerCase()
        const location = locationToken === 'query'
          ? 'query'
          : locationToken === 'path'
            ? 'path'
            : locationToken === 'header'
              ? 'header'
              : 'body'

        this.pushParam(params, {
          location,
          name: paramMatch[1] ?? 'param',
          required: location === 'path'
        })
      }

      const requestBodyTypeName = this.extractFastApiBodyTypeFromSnippet(sourceContext.snippet, path)
      endpoints.push(this.createEndpoint(file, 'fastapi', method, path, params, {
        requestBodyTypeName,
        sourceContext
      }))
    }

    return endpoints
  }

  private detectFlaskRoutes(file: CanonicalFile) {
    if (!/@[A-Za-z_][A-Za-z0-9_]*\.(?:route|get|post|put|patch|delete|options|head)\s*\(/i.test(file.content)) {
      return [] as RepoApiEndpoint[]
    }

    const blueprintPrefixes = new Map<string, string>()
    for (const match of file.content.matchAll(/([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Blueprint\(([\s\S]*?)\)/g)) {
      const blueprintName = match[1] ?? ''
      const args = match[2] ?? ''
      const prefixMatch = args.match(/\burl_prefix\s*=\s*['"`]([^'"`]+)['"`]/)
      if (blueprintName && prefixMatch?.[1]) {
        blueprintPrefixes.set(blueprintName, this.normalizeHttpPath(prefixMatch[1]))
      }
    }

    const endpoints: RepoApiEndpoint[] = []
    const shortcutPattern = /@([A-Za-z_][A-Za-z0-9_]*)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi
    for (const match of file.content.matchAll(shortcutPattern)) {
      const method = this.assertMethod(match[2] ?? '')
      if (!method) {
        continue
      }

      const owner = (match[1] ?? '').trim()
      const prefix = owner === 'app' ? '/' : (blueprintPrefixes.get(owner) ?? '/')
      const path = this.joinHttpPath(prefix, match[3] ?? '/')
      const params: RepoApiEndpointParameter[] = []
      const sourceContext = this.readSourceContext(file.content, match.index ?? 0, 420)
      this.addPathParameters(params, path)
      endpoints.push(this.createEndpoint(file, 'flask', method, path, params, { sourceContext }))
    }

    const routePattern = /@([A-Za-z_][A-Za-z0-9_]*)\.route\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*methods\s*=\s*\[([^\]]+)])?/gi
    for (const match of file.content.matchAll(routePattern)) {
      const owner = (match[1] ?? '').trim()
      const prefix = owner === 'app' ? '/' : (blueprintPrefixes.get(owner) ?? '/')
      const path = this.joinHttpPath(prefix, match[2] ?? '/')
      const params: RepoApiEndpointParameter[] = []
      const sourceContext = this.readSourceContext(file.content, match.index ?? 0, 420)
      this.addPathParameters(params, path)

      const methodsLiteral = match[3] ?? ''
      const methodsFromLiteral = [...methodsLiteral.matchAll(/['"`]([A-Za-z]+)['"`]/g)]
        .map(value => this.assertMethod(value[1] ?? ''))
        .filter((value): value is RepoApiHttpMethod => value !== null)

      const methods: RepoApiHttpMethod[] = methodsFromLiteral.length > 0 ? methodsFromLiteral : ['GET']
      for (const method of methods) {
        endpoints.push(this.createEndpoint(file, 'flask', method, path, params, { sourceContext }))
      }
    }

    return endpoints
  }

  private detectNestRoutes(file: CanonicalFile) {
    if (!file.content.includes('@Controller') || !/@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(/.test(file.content)) {
      return [] as RepoApiEndpoint[]
    }

    const controllerPrefixes = [...file.content.matchAll(
      /@Controller\s*\(\s*(?:['"`]([^'"`]*)['"`]|\{\s*[^}]*?\bpath\s*:\s*['"`]([^'"`]*)['"`][^}]*\})?\s*\)/g
    )]
      .map(match => match[1] ?? match[2] ?? '')

    const uniqueControllerPrefixes = Array.from(new Set(controllerPrefixes.length > 0 ? controllerPrefixes : ['']))
    const endpoints: RepoApiEndpoint[] = []
    const routePattern = /@(Get|Post|Put|Patch|Delete|Options|Head)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g

    for (const match of file.content.matchAll(routePattern)) {
      const method = this.assertMethod(match[1] ?? '')
      if (!method) {
        continue
      }

      const routePath = this.normalizeHttpPath(match[2] ?? '/')
      const sourceContext = this.readSourceContext(file.content, match.index ?? 0, 500)
      const symbolName = this.extractSymbolNameFromSnippet(sourceContext.snippet)

      const params: RepoApiEndpointParameter[] = []
      this.addPathParameters(params, routePath)

      for (const paramMatch of sourceContext.snippet.matchAll(/@Param\s*\(\s*['"`]([A-Za-z0-9_:-]+)['"`]/g)) {
        this.pushParam(params, {
          location: 'path',
          name: paramMatch[1] ?? 'param',
          required: true
        })
      }

      for (const paramMatch of sourceContext.snippet.matchAll(/@Query\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g)) {
        this.pushParam(params, {
          location: 'query',
          name: paramMatch[1] ?? 'query',
          required: false
        })
      }

      for (const paramMatch of sourceContext.snippet.matchAll(/@Headers\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g)) {
        this.pushParam(params, {
          location: 'header',
          name: paramMatch[1] ?? 'header',
          required: false
        })
      }

      if (/@Body\s*\(/.test(sourceContext.snippet)) {
        const namedBodyMatch = sourceContext.snippet.match(/@Body\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/)
        this.pushParam(params, {
          location: 'body',
          name: namedBodyMatch?.[1] ?? 'body',
          required: false
        })
      }

      const requestBodyTypeName = this.extractNestBodyTypeFromSnippet(sourceContext.snippet)
      for (const controllerPrefix of uniqueControllerPrefixes) {
        const path = this.joinHttpPath(controllerPrefix, routePath)
        endpoints.push(this.createEndpoint(file, 'nestjs', method, path, params, {
          requestBodyTypeName,
          sourceContext,
          symbolName
        }))
      }
    }

    return endpoints
  }

  private extractBracedBlock(content: string, startBraceIndex: number): null | string {
    if (startBraceIndex < 0 || startBraceIndex >= content.length || content[startBraceIndex] !== '{') {
      return null
    }

    let depth = 0
    for (let index = startBraceIndex; index < content.length; index += 1) {
      const char = content[index]
      if (char === '{') {
        depth += 1
      } else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          return content.slice(startBraceIndex + 1, index)
        }
      }
    }

    return null
  }

  private extractFastApiBodyTypeFromSnippet(snippet: string, path: string): string | undefined {
    const pathParamNames = new Set(parsePathParamNames(path))
    const typedParamPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_.[\],<>]*)\s*(?:=\s*([^,\n)]+))?/g

    for (const match of snippet.matchAll(typedParamPattern)) {
      const name = match[1] ?? ''
      const rawType = match[2] ?? ''
      const defaultExpr = (match[3] ?? '').trim()

      if (!name || pathParamNames.has(name)) {
        continue
      }

      if (/\b(Query|Path|Header)\s*\(/.test(defaultExpr)) {
        continue
      }

      const typeName = this.normalizeTypeName(rawType)
      if (!typeName || this.isPrimitiveTypeName(typeName)) {
        continue
      }

      return typeName
    }

    return undefined
  }

  private extractNestBodyTypeFromSnippet(snippet: string): string | undefined {
    const match = snippet.match(
      /@Body\s*\([^)]*\)\s*(?:public\s+|private\s+|protected\s+|readonly\s+)?[A-Za-z_][A-Za-z0-9_]*\s*:\s*([A-Za-z_][A-Za-z0-9_.<>]*)/
    )

    return this.normalizeTypeName(match?.[1])
  }

  private extractPythonObjectSchemas(content: string): Record<string, RepoOpenApiSchema> {
    const schemas: Record<string, RepoOpenApiSchema> = {}
    const classPattern = /^class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:\s*$/gm

    for (const classMatch of content.matchAll(classPattern)) {
      const typeName = this.normalizeTypeName(classMatch[1])
      const bases = classMatch[2] ?? ''
      if (!typeName || !/\b(BaseModel|Serializer|Schema)\b/.test(bases)) {
        continue
      }

      const start = classMatch.index ?? 0
      const afterClass = content.slice(start)
      const bodyMatch = afterClass.match(/^class[^\n]*\n((?:[ \t]+[^\n]*\n?)*)/m)
      const body = bodyMatch?.[1] ?? ''
      const properties: Record<string, RepoOpenApiSchema> = {}
      const required: string[] = []

      for (const fieldMatch of body.matchAll(/^[ \t]+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^\n=]+)(?:\s*=\s*(.+))?$/gm)) {
        const name = fieldMatch[1] ?? ''
        const rawType = fieldMatch[2] ?? ''
        if (!name) {
          continue
        }

        properties[name] = this.inferSchemaFromTypeHint(rawType)

        const hasDefault = typeof fieldMatch[3] === 'string' && fieldMatch[3].trim().length > 0
        if (!hasDefault && !/\bOptional\[/i.test(rawType)) {
          required.push(name)
        }
      }

      if (Object.keys(properties).length === 0) {
        continue
      }

      schemas[typeName] = {
        properties,
        required: required.length > 0 ? required : undefined,
        type: 'object'
      }
    }

    return schemas
  }

  private extractSchemasFromFile(file: CanonicalFile): Record<string, RepoOpenApiSchema> {
    if (!file.content.trim()) {
      return {}
    }

    const fromTs = this.extractTypeScriptObjectSchemas(file.content)
    const fromPy = this.extractPythonObjectSchemas(file.content)
    return {
      ...fromTs,
      ...fromPy
    }
  }

  private extractSymbolNameFromSnippet(snippet: string) {
    const candidatePatterns = [
      /\basync\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
      /\b([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/,
      /\bdef\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/
    ]

    for (const pattern of candidatePatterns) {
      const match = snippet.match(pattern)
      if (match?.[1]) {
        return match[1]
      }
    }

    return undefined
  }

  private extractTypeScriptObjectSchemas(content: string): Record<string, RepoOpenApiSchema> {
    const schemas: Record<string, RepoOpenApiSchema> = {}
    const patterns = [
      /(?:export\s+)?interface\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g,
      /(?:export\s+)?type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\{/g,
      /(?:export\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)[^{]*\{/g
    ]

    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        const typeName = this.normalizeTypeName(match[1])
        if (!typeName) {
          continue
        }

        const braceIndex = (match.index ?? 0) + match[0].lastIndexOf('{')
        const block = this.extractBracedBlock(content, braceIndex)
        if (!block) {
          continue
        }

        const properties: Record<string, RepoOpenApiSchema> = {}
        const required: string[] = []

        for (const propertyMatch of block.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\??\s*:\s*([^;\n]+)[;,]?/gm)) {
          const name = propertyMatch[1] ?? ''
          const rawType = propertyMatch[2] ?? ''
          if (!name || /\breadonly\b/.test(name)) {
            continue
          }

          const schema = this.inferSchemaFromTypeHint(rawType)
          properties[name] = schema

          const isOptional = propertyMatch[0].includes('?:') || /\|\s*undefined\b/.test(rawType)
          if (!isOptional) {
            required.push(name)
          }
        }

        if (Object.keys(properties).length === 0) {
          continue
        }

        schemas[typeName] = {
          properties,
          required: required.length > 0 ? required : undefined,
          type: 'object'
        }
      }
    }

    return schemas
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

  private findRuntimePathForStatic(
    staticPath: string,
    method: RepoOpenApiOperationMethod,
    runtimePaths: RepoOpenApiDocument['paths']
  ) {
    const candidates = this.buildPathMatchCandidates(staticPath)
    for (const candidate of candidates) {
      const operation = runtimePaths[candidate]?.[method]
      if (operation) {
        return candidate
      }
    }

    return null
  }

  private findStaticOperationForRuntimePath(
    staticPaths: RepoOpenApiDocument['paths'],
    runtimePath: string,
    method: RepoOpenApiOperationMethod
  ) {
    const candidates = this.buildPathMatchCandidates(runtimePath)
    for (const candidate of candidates) {
      const operation = staticPaths[candidate]?.[method]
      if (operation) {
        return operation
      }
    }

    return null
  }

  private inferModuleName(filePath: string, framework: RepoApiFramework) {
    const segments = filePath.split('/').filter(Boolean)
    if (segments.length === 0) {
      return framework
    }

    const lowercase = segments.map(segment => segment.toLowerCase())
    const markerCandidates = [
      'modules',
      'module',
      'routers',
      'router',
      'controllers',
      'controller',
      'routes',
      'route',
      'views',
      'view',
      'blueprints',
      'blueprint',
      'apps',
      'api'
    ]

    for (const marker of markerCandidates) {
      const markerIndex = lowercase.lastIndexOf(marker)
      if (markerIndex < 0) {
        continue
      }

      const nextSegment = segments[markerIndex + 1]
      if (nextSegment && !nextSegment.includes('.')) {
        return this.normalizeModuleSegment(nextSegment)
      }
    }

    const fileName = segments[segments.length - 1] ?? framework
    return this.normalizeModuleSegment(fileName)
  }

  private inferSchemaFromTypeHint(rawType: string): RepoOpenApiSchema {
    const normalized = rawType
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\(/, '')
      .replace(/\)$/, '')
    const lower = normalized.toLowerCase()

    if (!normalized) {
      return { type: 'string' }
    }

    if (lower.startsWith('array<') || /\[\]$/.test(normalized) || lower.startsWith('list[') || lower.startsWith('sequence[')) {
      return {
        items: {
          type: 'string'
        },
        type: 'array'
      }
    }

    if (/\b(bool|boolean)\b/i.test(normalized)) {
      return { type: 'boolean' }
    }

    if (/\b(int|integer|int32|int64)\b/i.test(normalized)) {
      return { type: 'integer' }
    }

    if (/\b(number|float|double|decimal)\b/i.test(normalized)) {
      return { type: 'number' }
    }

    if (/\b(object|dict|map|record)\b/i.test(normalized)) {
      return {
        additionalProperties: true,
        type: 'object'
      }
    }

    return { type: 'string' }
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

  private isPrimitiveTypeName(typeName: string) {
    return new Set([
      'Any',
      'Dict',
      'List',
      'None',
      'Optional',
      'Union',
      'bool',
      'dict',
      'float',
      'int',
      'object',
      'str',
      'string'
    ]).has(typeName)
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

  private joinHttpPath(prefix: string, path: string) {
    const normalizedPrefix = this.normalizeHttpPath(prefix)
    const normalizedPath = this.normalizeHttpPath(path)

    if (normalizedPrefix === '/') {
      return normalizedPath
    }

    if (normalizedPath === '/') {
      return normalizedPrefix
    }

    return this.normalizeHttpPath(`${normalizedPrefix}/${normalizedPath}`)
  }

  private mergeOperationSources(existing: RepoOpenApiOperation, nextOperation: RepoOpenApiOperation) {
    const allSources: RepoOpenApiSourceMetadata[] = []

    if (existing['x-codepath']) {
      allSources.push(existing['x-codepath'])
    }
    if (existing['x-codepath-sources']) {
      allSources.push(...existing['x-codepath-sources'])
    }
    if (nextOperation['x-codepath']) {
      allSources.push(nextOperation['x-codepath'])
    }

    const unique = new Map<string, RepoOpenApiSourceMetadata>()
    for (const source of allSources) {
      const key = `${source.framework}:${source.filePath}:${source.symbolName ?? ''}`
      unique.set(key, source)
    }

    return [...unique.values()]
  }

  private mergeRuntimeOpenApiWithStatic(
    runtimeSpec: RepoOpenApiDocument,
    staticSpec: RepoOpenApiDocument
  ): RepoOpenApiDocument {
    const mergedPaths: RepoOpenApiDocument['paths'] = {}
    const runtimePaths = runtimeSpec.paths ?? {}
    const staticPaths = staticSpec.paths ?? {}

    for (const [runtimePath, runtimeOperations] of Object.entries(runtimePaths)) {
      const mergedOperations: Partial<Record<RepoOpenApiOperationMethod, RepoOpenApiOperation>> = {}

      for (const [rawMethod, runtimeOperation] of Object.entries(runtimeOperations ?? {})) {
        const method = rawMethod as RepoOpenApiOperationMethod
        if (!runtimeOperation) {
          continue
        }

        const staticOperation = this.findStaticOperationForRuntimePath(staticPaths, runtimePath, method)
        if (!staticOperation) {
          mergedOperations[method] = runtimeOperation
          continue
        }

        const mergedSources = this.mergeOperationSources(runtimeOperation, staticOperation)
        const mergedTags = this.mergeTagValues(runtimeOperation.tags, staticOperation.tags)

        mergedOperations[method] = {
          ...runtimeOperation,
          operationId: runtimeOperation.operationId || staticOperation.operationId,
          tags: mergedTags.length > 0 ? mergedTags : runtimeOperation.tags,
          'x-codepath': runtimeOperation['x-codepath'] ?? staticOperation['x-codepath'],
          'x-codepath-sources': mergedSources
        }
      }

      mergedPaths[runtimePath] = mergedOperations
    }

    for (const [staticPath, staticOperations] of Object.entries(staticPaths)) {
      for (const [rawMethod, staticOperation] of Object.entries(staticOperations ?? {})) {
        const method = rawMethod as RepoOpenApiOperationMethod
        if (!staticOperation) {
          continue
        }

        const runtimeMatch = this.findRuntimePathForStatic(staticPath, method, runtimePaths)
        if (runtimeMatch) {
          continue
        }

        if (!mergedPaths[staticPath]) {
          mergedPaths[staticPath] = {}
        }
        mergedPaths[staticPath][method] = staticOperation
      }
    }

    const runtimeSchemas = runtimeSpec.components?.schemas ?? {}
    const staticSchemas = staticSpec.components?.schemas ?? {}
    const mergedSchemas = {
      ...staticSchemas,
      ...runtimeSchemas
    }

    const mergedTags = this.mergeTagValues(
      runtimeSpec.tags?.map(tag => tag.name),
      staticSpec.tags?.map(tag => tag.name)
    ).map(name => ({ name }))

    return {
      components: Object.keys(mergedSchemas).length > 0
        ? {
          schemas: mergedSchemas
        }
        : undefined,
      info: runtimeSpec.info?.title ? runtimeSpec.info : staticSpec.info,
      openapi: '3.1.0',
      paths: mergedPaths,
      tags: mergedTags.length > 0 ? mergedTags : runtimeSpec.tags
    }
  }

  private mergeTagValues(...tagsLists: Array<Array<string> | undefined>) {
    return Array.from(
      new Set(
        tagsLists
          .flatMap(list => list ?? [])
          .map(value => value.trim())
          .filter(Boolean)
      )
    )
  }

  private normalizeCollectionConfig(config: RepoApiRunnerCollectionConfig): RepoApiRunnerCollectionConfig {
    if (!config || typeof config !== 'object') {
      throw new BadRequestException('Collection config is required')
    }

    const timeoutMs = Number.isFinite(config.timeoutMs)
      ? Math.min(RUNNER_MAX_TIMEOUT_MS, Math.max(1_000, Math.trunc(config.timeoutMs)))
      : RUNNER_DEFAULT_TIMEOUT_MS

    return {
      auth: this.normalizeRunnerAuthConfig(config.auth),
      baseUrl: String(config.baseUrl ?? ''),
      bodyJson: String(config.bodyJson ?? '{}'),
      endpointId: config.endpointId ? String(config.endpointId) : null,
      endpointMethod: this.assertMethod(String(config.endpointMethod ?? '')) ?? null,
      endpointPath: config.endpointPath ? String(config.endpointPath) : null,
      headersJson: String(config.headersJson ?? '{}'),
      pathValues: typeof config.pathValues === 'object' && config.pathValues !== null
        ? Object.fromEntries(
          Object.entries(config.pathValues).map(([key, value]) => [String(key), String(value)])
        )
        : {},
      queryJson: String(config.queryJson ?? '{}'),
      timeoutMs
    }
  }

  private normalizeCollectionName(name: string) {
    return this.normalizeName(name, RUNNER_COLLECTION_NAME_MAX_LENGTH, 'Collection name')
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

  private normalizeHttpPath(path: string) {
    const trimmed = path.trim()
    if (!trimmed || trimmed === '.') {
      return '/'
    }

    let normalized = trimmed
      .replaceAll('\\', '/')
      .replace(/\/{2,}/g, '/')
      .replace(/^\.\/+/, '')

    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`
    }

    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1)
    }

    return normalized
  }

  private normalizeModuleSegment(segment: string) {
    const cleaned = segment
      .replace(/\.[^.]+$/, '')
      .replace(/(?:\.|_)?(controller|controllers|route|routes|router|routers|view|views|handler|handlers)$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()

    return cleaned.length > 0 ? cleaned : segment
  }

  private normalizeName(name: string, maxLength: number, label: string) {
    const normalizedName = typeof name === 'string' ? name.trim() : ''
    if (!normalizedName) {
      throw new BadRequestException(`${label} is required`)
    }
    if (normalizedName.length > maxLength) {
      throw new BadRequestException(`${label} max length is ${maxLength}`)
    }

    return normalizedName
  }

  private normalizeRunnerAuthConfig(input: unknown): RepoApiRunnerAuthConfig {
    const safeAuth = input && typeof input === 'object'
      ? (input as Record<string, unknown>)
      : {}

    const rawMode = String(safeAuth.mode ?? '')
    const mode: RepoApiRunnerAuthMode = RUNNER_AUTH_MODES.includes(rawMode as RepoApiRunnerAuthMode)
      ? (rawMode as RepoApiRunnerAuthMode)
      : 'none'

    return {
      apiKeyName: String(safeAuth.apiKeyName ?? 'x-api-key'),
      apiKeyPlacement: safeAuth.apiKeyPlacement === 'query' ? 'query' : 'header',
      apiKeyValue: String(safeAuth.apiKeyValue ?? ''),
      basicPassword: String(safeAuth.basicPassword ?? ''),
      basicUsername: String(safeAuth.basicUsername ?? ''),
      bearerToken: String(safeAuth.bearerToken ?? ''),
      mode
    }
  }

  private normalizeRunnerHeaders(headers?: Record<string, string>) {
    const normalized: Record<string, string> = {}
    if (!headers || typeof headers !== 'object') {
      return normalized
    }

    for (const [rawKey, rawValue] of Object.entries(headers)) {
      const key = rawKey.trim().toLowerCase()
      if (!key || ['connection', 'content-length', 'host'].includes(key)) {
        continue
      }

      const value = typeof rawValue === 'string' ? rawValue.trim() : String(rawValue)
      if (!value) {
        continue
      }

      normalized[key] = value
    }

    return normalized
  }

  private normalizeRunnerTimeout(timeoutMs?: number) {
    if (!Number.isFinite(timeoutMs)) {
      return RUNNER_DEFAULT_TIMEOUT_MS
    }

    return Math.min(RUNNER_MAX_TIMEOUT_MS, Math.max(1_000, Math.trunc(timeoutMs as number)))
  }

  private normalizeRunnerUrl(url: string) {
    if (typeof url !== 'string' || !url.trim()) {
      throw new BadRequestException('Runner URL is required')
    }

    try {
      return new URL(url.trim()).toString()
    } catch {
      throw new BadRequestException('Runner URL is invalid')
    }
  }

  private normalizeRuntimeOpenApiDocument(input: unknown): null | RepoOpenApiDocument {
    if (!input || typeof input !== 'object') {
      return null
    }

    const raw = input as Record<string, unknown>
    if (typeof raw.openapi !== 'string') {
      return null
    }

    if (!raw.paths || typeof raw.paths !== 'object' || Array.isArray(raw.paths)) {
      return null
    }

    const infoRaw = raw.info && typeof raw.info === 'object' ? raw.info as Record<string, unknown> : {}
    const runtimeTags = Array.isArray(raw.tags)
      ? raw.tags
        .map(item => {
          if (!item || typeof item !== 'object') {
            return null
          }
          const name = (item as Record<string, unknown>).name
          return typeof name === 'string' && name.trim() ? { name: name.trim() } : null
        })
        .filter((value): value is { name: string } => value !== null)
      : undefined

    const componentsRaw = raw.components && typeof raw.components === 'object'
      ? raw.components as Record<string, unknown>
      : undefined
    const schemasRaw = componentsRaw?.schemas && typeof componentsRaw.schemas === 'object' && !Array.isArray(componentsRaw.schemas)
      ? componentsRaw.schemas as Record<string, RepoOpenApiSchema>
      : undefined

    return {
      components: schemasRaw
        ? {
          schemas: schemasRaw
        }
        : undefined,
      info: {
        description: typeof infoRaw.description === 'string' ? infoRaw.description : '',
        title: typeof infoRaw.title === 'string' ? infoRaw.title : 'Runtime OpenAPI',
        version: typeof infoRaw.version === 'string' ? infoRaw.version : '0.1.0'
      },
      openapi: '3.1.0',
      paths: raw.paths as RepoOpenApiDocument['paths'],
      tags: runtimeTags
    }
  }

  private normalizeTypeName(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined
    }

    const normalized = value
      .trim()
      .split(/[\s<>\[\],|]/)[0]
      ?.replace(/^.*\./, '')
      ?.replace(/[^A-Za-z0-9_]/g, '')

    if (!normalized || normalized.length === 0) {
      return undefined
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

  private pushParam(params: RepoApiEndpointParameter[], nextParam: RepoApiEndpointParameter) {
    if (params.some(param => param.location === nextParam.location && param.name === nextParam.name)) {
      return
    }

    params.push(nextParam)
  }

  private readSnippet(content: string, start: number, size: number) {
    if (start < 0) {
      return content.slice(0, size)
    }

    return content.slice(start, Math.min(content.length, start + size))
  }

  private readSourceContext(content: string, start: number, size: number): SourceContext {
    const safeStart = Math.max(0, start)
    const lineStart = content.slice(0, safeStart).split('\n').length
    const snippet = this.readSnippet(content, safeStart, size).trim()

    return {
      lineStart,
      snippet
    }
  }

  private safeString(value: unknown) {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private sourceFromEndpoint(endpoint: RepoApiEndpoint): RepoOpenApiSourceMetadata {
    return {
      filePath: endpoint.filePath,
      framework: endpoint.framework,
      symbolName: endpoint.symbolName
    }
  }

  private toOpenApiOperation(
    endpoint: RepoApiEndpoint,
    openApiPath: string,
    schemaRegistry: Record<string, RepoOpenApiSchema>
  ): RepoOpenApiOperation {
    const parameters: RepoOpenApiParameter[] = endpoint.params
      .filter(
        (
          param
        ): param is RepoApiEndpointParameter & { location: 'header' | 'path' | 'query' } => param.location !== 'body'
      )
      .map(param => ({
        in: param.location,
        name: param.name,
        required: param.location === 'path' ? true : param.required,
        schema: {
          type: 'string' as const
        }
      }))

    const bodyParams = endpoint.params.filter(param => param.location === 'body')
    const bodyProperties = Object.fromEntries(
      bodyParams.map(param => [
        param.name === 'body' ? 'payload' : param.name,
        {
          type: 'string' as const
        }
      ])
    )
    const requiredBodyProperties = bodyParams
      .filter(param => param.required)
      .map(param => param.name === 'body' ? 'payload' : param.name)
    const requestBodyTypeName = this.normalizeTypeName(endpoint.requestBodyTypeName)

    const operation: RepoOpenApiOperation = {
      operationId: this.toOperationId(endpoint),
      responses: {
        '200': {
          description: 'Successful response'
        }
      },
      summary: `${endpoint.method} ${openApiPath}`,
      tags: [endpoint.moduleName || endpoint.framework],
      'x-codepath': this.sourceFromEndpoint(endpoint)
    }

    if (parameters.length > 0) {
      operation.parameters = parameters
    }

    if (bodyParams.length > 0 || (requestBodyTypeName && schemaRegistry[requestBodyTypeName])) {
      const schema = requestBodyTypeName && schemaRegistry[requestBodyTypeName]
        ? { $ref: `#/components/schemas/${requestBodyTypeName}` }
        : {
          additionalProperties: true,
          properties: bodyProperties,
          required: requiredBodyProperties.length > 0 ? requiredBodyProperties : undefined,
          type: 'object' as const
        }

      operation.requestBody = {
        content: {
          'application/json': {
            schema
          }
        },
        required: requestBodyTypeName ? true : requiredBodyProperties.length > 0
      }
    }

    return operation
  }

  private toOpenApiPath(path: string) {
    return this.normalizeHttpPath(path)
      .replace(/:([A-Za-z0-9_]+)/g, '{$1}')
      .replace(/<(?:(?:[A-Za-z0-9_]+):)?([A-Za-z0-9_]+)>/g, '{$1}')
  }

  private toOperationId(endpoint: RepoApiEndpoint) {
    const methodPart = endpoint.method.toLowerCase()
    const pathPart = endpoint.path
      .replace(/^\/+/, '')
      .replace(/[{}<>:]/g, '')
      .replace(/[^A-Za-z0-9/_-]+/g, '')
      .replace(/[/-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      || 'root'
    const filePart = endpoint.filePath
      .replace(/[^A-Za-z0-9/_-]+/g, '')
      .replace(/[/-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      || 'file'
    const symbolPart = endpoint.symbolName
      ? endpoint.symbolName.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '')
      : 'handler'

    return `${methodPart}_${pathPart}_${filePart}_${symbolPart}`
  }

  private toPlainHeaders(headers: unknown) {
    const normalized: Record<string, string> = {}
    if (!headers || typeof headers !== 'object') {
      return normalized
    }

    for (const [rawKey, rawValue] of Object.entries(headers)) {
      const key = rawKey.toLowerCase()
      if (!key) {
        continue
      }

      if (Array.isArray(rawValue)) {
        normalized[key] = rawValue.map(value => String(value)).join(', ')
        continue
      }

      if (typeof rawValue === 'string') {
        normalized[key] = rawValue
        continue
      }

      if (rawValue === undefined || rawValue === null) {
        continue
      }

      normalized[key] = String(rawValue)
    }

    return normalized
  }

  private async tryFetchRuntimeOpenApiDocument(runtimeBaseUrl: string): Promise<null | RepoOpenApiDocument> {
    for (const candidatePath of RUNTIME_OPENAPI_CANDIDATE_PATHS) {
      const candidateUrl = new URL(candidatePath, runtimeBaseUrl).toString()
      try {
        const response = await axios.request<unknown>({
          maxContentLength: RUNNER_MAX_RESPONSE_BYTES,
          method: 'GET',
          timeout: RUNTIME_OPENAPI_TIMEOUT_MS,
          url: candidateUrl,
          validateStatus: status => status >= 200 && status < 300
        })

        const normalized = this.normalizeRuntimeOpenApiDocument(response.data)
        if (normalized) {
          this.logger.log(`Using runtime OpenAPI from ${candidateUrl}`)
          return normalized
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
