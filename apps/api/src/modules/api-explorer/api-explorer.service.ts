import { posix as pathPosix } from 'node:path'

import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import type {
  RepoApiEndpoint,
  RepoApiEndpointParameter,
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoInteractiveApi,
  RepoOpenApiDocument,
  RepoOpenApiOperation,
  RepoOpenApiOperationMethod,
  RepoOpenApiSourceMetadata
} from '@workspace/codepath-common/api-explorer'
import { and, eq } from 'drizzle-orm'

import { env } from '../../config/env'
import { DbService } from '../db/db.service'
import { repos } from '../db/schema'
import { QdrantService } from '../qdrant/qdrant.service'

interface ApiExplorerQuery {
  frameworks?: string
  methods?: string
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

@Injectable()
export class ApiExplorerService {
  private readonly logger = new Logger(ApiExplorerService.name)

  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService
  ) {}

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
          endpoint.path,
          endpoint.symbolName ?? ''
        ].join(' ').toLowerCase()

        return haystack.includes(search)
      })
    }

    endpoints.sort((a, b) => {
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

    const frameworks = Array.from(new Set(endpoints.map(endpoint => endpoint.framework))).sort() as RepoApiFramework[]
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
    const paths: RepoOpenApiDocument['paths'] = {}

    for (const endpoint of interactiveApi.endpoints) {
      const openApiPath = this.toOpenApiPath(endpoint.path)
      const openApiMethod = METHOD_TO_OPENAPI[endpoint.method]
      const nextOperation = this.toOpenApiOperation(endpoint, openApiPath)

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

    return {
      info: {
        description: `Generated from repository segments for repo ${interactiveApi.metadata.repoId}`,
        title: `${interactiveApi.metadata.repoName} Interactive API`,
        version: '0.1.0'
      },
      openapi: '3.1.0',
      paths
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

  private createEndpoint(
    file: CanonicalFile,
    framework: RepoApiFramework,
    method: RepoApiHttpMethod,
    path: string,
    params: RepoApiEndpointParameter[],
    symbolName?: string
  ): RepoApiEndpoint {
    return {
      filePath: file.filePath,
      framework,
      id: `${framework}:${method}:${file.filePath}:${path}`,
      method,
      params: this.uniqueParams(params),
      path,
      symbolName
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
      this.addPathParameters(params, path)
      endpoints.push(this.createEndpoint(file, 'django', 'GET', path, params))
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

      const snippet = this.readSnippet(file.content, match.index ?? 0, 450)
      for (const reqParamMatch of snippet.matchAll(/\breq\.params\.([A-Za-z0-9_]+)/g)) {
        this.pushParam(params, {
          location: 'path',
          name: reqParamMatch[1] ?? 'param',
          required: true
        })
      }

      for (const reqParamMatch of snippet.matchAll(/\breq\.query\.([A-Za-z0-9_]+)/g)) {
        this.pushParam(params, {
          location: 'query',
          name: reqParamMatch[1] ?? 'query',
          required: false
        })
      }

      for (const reqParamMatch of snippet.matchAll(/\breq\.body\.([A-Za-z0-9_]+)/g)) {
        this.pushParam(params, {
          location: 'body',
          name: reqParamMatch[1] ?? 'body',
          required: false
        })
      }

      endpoints.push(this.createEndpoint(file, 'express', method, path, params))
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

      const snippet = this.readSnippet(file.content, match.index ?? 0, 500)
      for (const paramMatch of snippet.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*[^=,\n)]+\s*=\s*(Query|Path|Body|Header)\(/g)) {
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

      endpoints.push(this.createEndpoint(file, 'fastapi', method, path, params))
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
      this.addPathParameters(params, path)
      endpoints.push(this.createEndpoint(file, 'flask', method, path, params))
    }

    const routePattern = /@([A-Za-z_][A-Za-z0-9_]*)\.route\(\s*['"`]([^'"`]+)['"`]\s*(?:,\s*methods\s*=\s*\[([^\]]+)])?/gi
    for (const match of file.content.matchAll(routePattern)) {
      const owner = (match[1] ?? '').trim()
      const prefix = owner === 'app' ? '/' : (blueprintPrefixes.get(owner) ?? '/')
      const path = this.joinHttpPath(prefix, match[2] ?? '/')
      const params: RepoApiEndpointParameter[] = []
      this.addPathParameters(params, path)

      const methodsLiteral = match[3] ?? ''
      const methodsFromLiteral = [...methodsLiteral.matchAll(/['"`]([A-Za-z]+)['"`]/g)]
        .map(value => this.assertMethod(value[1] ?? ''))
        .filter((value): value is RepoApiHttpMethod => value !== null)

      const methods: RepoApiHttpMethod[] = methodsFromLiteral.length > 0 ? methodsFromLiteral : ['GET']
      for (const method of methods) {
        endpoints.push(this.createEndpoint(file, 'flask', method, path, params))
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
      const snippet = this.readSnippet(file.content, match.index ?? 0, 500)
      const symbolName = this.extractSymbolNameFromSnippet(snippet)

      const params: RepoApiEndpointParameter[] = []
      this.addPathParameters(params, routePath)

      for (const paramMatch of snippet.matchAll(/@Param\s*\(\s*['"`]([A-Za-z0-9_:-]+)['"`]/g)) {
        this.pushParam(params, {
          location: 'path',
          name: paramMatch[1] ?? 'param',
          required: true
        })
      }

      for (const paramMatch of snippet.matchAll(/@Query\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g)) {
        this.pushParam(params, {
          location: 'query',
          name: paramMatch[1] ?? 'query',
          required: false
        })
      }

      for (const paramMatch of snippet.matchAll(/@Headers\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g)) {
        this.pushParam(params, {
          location: 'header',
          name: paramMatch[1] ?? 'header',
          required: false
        })
      }

      if (/@Body\s*\(/.test(snippet)) {
        const namedBodyMatch = snippet.match(/@Body\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/)
        this.pushParam(params, {
          location: 'body',
          name: namedBodyMatch?.[1] ?? 'body',
          required: false
        })
      }

      for (const controllerPrefix of uniqueControllerPrefixes) {
        const path = this.joinHttpPath(controllerPrefix, routePath)
        endpoints.push(this.createEndpoint(file, 'nestjs', method, path, params, symbolName))
      }
    }

    return endpoints
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

  private sourceFromEndpoint(endpoint: RepoApiEndpoint): RepoOpenApiSourceMetadata {
    return {
      filePath: endpoint.filePath,
      framework: endpoint.framework,
      symbolName: endpoint.symbolName
    }
  }

  private toOpenApiOperation(endpoint: RepoApiEndpoint, openApiPath: string): RepoOpenApiOperation {
    const parameters = endpoint.params
      .filter(param => param.location !== 'body')
      .map(param => ({
        in: param.location,
        name: param.name,
        required: param.location === 'path' ? true : param.required,
        schema: {
          type: 'string' as const
        }
      }))

    const bodyParams = endpoint.params.filter(param => param.location === 'body')
    const bodyProperties = Object.fromEntries(bodyParams.map(param => [
      param.name === 'body' ? 'payload' : param.name,
      {
        type: 'string' as const
      }
    ]))
    const requiredBodyProperties = bodyParams
      .filter(param => param.required)
      .map(param => param.name === 'body' ? 'payload' : param.name)

    const operation: RepoOpenApiOperation = {
      operationId: this.toOperationId(endpoint),
      responses: {
        '200': {
          description: 'Successful response'
        }
      },
      summary: `${endpoint.method} ${openApiPath}`,
      tags: [endpoint.framework],
      'x-codepath': this.sourceFromEndpoint(endpoint)
    }

    if (parameters.length > 0) {
      operation.parameters = parameters
    }

    if (bodyParams.length > 0) {
      operation.requestBody = {
        content: {
          'application/json': {
            schema: {
              additionalProperties: true,
              properties: bodyProperties,
              required: requiredBodyProperties.length > 0 ? requiredBodyProperties : undefined,
              type: 'object'
            }
          }
        },
        required: requiredBodyProperties.length > 0
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

  private safeString(value: unknown) {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
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
      params: mergedParams,
      symbolName: existing.symbolName ?? endpoint.symbolName
    })
  }
}
