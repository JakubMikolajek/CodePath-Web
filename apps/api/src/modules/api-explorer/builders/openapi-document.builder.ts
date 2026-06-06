import type { Nullable, Undefinable } from '@workspace/codepath-common'
import type {
  RepoApiEndpoint,
  RepoInteractiveApi,
  RepoOpenApiDocument,
  RepoOpenApiOperation,
  RepoOpenApiParameter,
  RepoOpenApiSchema,
  RepoOpenApiSourceMetadata
} from '@workspace/codepath-common/api-explorer'
import {
  OpenApiVersion,
  RepoApiHttpMethod,
  RepoApiParameterLocation,
  RepoOpenApiOperationMethod,
  RepoOpenApiParameterIn,
  RepoOpenApiSchemaType,
  RepoOpenApiSourceMode
} from '@workspace/codepath-common/api-explorer'

import { normalizeHttpPath } from '../../../utils/helpers'

const METHOD_TO_OPENAPI: Record<RepoApiHttpMethod, RepoOpenApiOperationMethod> = {
  [RepoApiHttpMethod.DELETE]: RepoOpenApiOperationMethod.DELETE,
  [RepoApiHttpMethod.GET]: RepoOpenApiOperationMethod.GET,
  [RepoApiHttpMethod.HEAD]: RepoOpenApiOperationMethod.HEAD,
  [RepoApiHttpMethod.OPTIONS]: RepoOpenApiOperationMethod.OPTIONS,
  [RepoApiHttpMethod.PATCH]: RepoOpenApiOperationMethod.PATCH,
  [RepoApiHttpMethod.POST]: RepoOpenApiOperationMethod.POST,
  [RepoApiHttpMethod.PUT]: RepoOpenApiOperationMethod.PUT
}

const SUPPORTED_OPENAPI_METHODS: RepoOpenApiOperationMethod[] = [
  RepoOpenApiOperationMethod.DELETE,
  RepoOpenApiOperationMethod.GET,
  RepoOpenApiOperationMethod.HEAD,
  RepoOpenApiOperationMethod.OPTIONS,
  RepoOpenApiOperationMethod.PATCH,
  RepoOpenApiOperationMethod.POST,
  RepoOpenApiOperationMethod.PUT
]

export class OpenApiDocumentBuilder {
  buildStaticSpec(interactiveApi: RepoInteractiveApi, schemaRegistry: Record<string, RepoOpenApiSchema>): RepoOpenApiDocument {
    const paths: RepoOpenApiDocument['paths'] = {}

    for (const endpoint of interactiveApi.endpoints) {
      const openApiPath = this.toOpenApiPath(endpoint.path)
      const openApiMethod = METHOD_TO_OPENAPI[endpoint.method]
      const nextOperation = this.toOpenApiOperation(endpoint, openApiPath, schemaRegistry)

      if (!paths[openApiPath]) paths[openApiPath] = {}

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
      new Set(interactiveApi.endpoints.map(endpoint => endpoint.moduleName || endpoint.framework))).sort((a, b) => a.localeCompare(b)).map(name => ({ name })
    )

    const staticOperationCount = this.countOpenApiOperations(paths)
    const staticOperationsWithCodeSource = this.countOperationsWithCodeSource(paths)
    const staticSchemaComponentCount = Object.keys(schemaRegistry).length
    const staticModuleTagCount = tags.length

    return {
      components: Object.keys(schemaRegistry).length > 0 ? { schemas: schemaRegistry } : undefined,
      info: {
        description: `Generated from repository segments for repo ${interactiveApi.metadata.repoId}`,
        title: `${interactiveApi.metadata.repoName} Interactive API`,
        version: '0.1.0'
      },
      openapi: OpenApiVersion.V3_1_0,
      paths,
      tags,
      'x-codepath-metrics': {
        codeSourceCoverage: this.toRatio(staticOperationsWithCodeSource, staticOperationCount),
        mergedOperationCount: staticOperationCount,
        moduleTagCount: staticModuleTagCount,
        operationCount: staticOperationCount,
        operationsWithCodeSource: staticOperationsWithCodeSource,
        runtimeOperationCount: 0,
        schemaComponentCount: staticSchemaComponentCount,
        sourceMode: RepoOpenApiSourceMode.STATIC,
        staticOperationCount
      }
    }
  }

  mergeRuntimeOpenApiWithStatic(runtimeSpec: RepoOpenApiDocument, staticSpec: RepoOpenApiDocument, runtimeResolvedUrl?: string): RepoOpenApiDocument {
    const mergedPaths: RepoOpenApiDocument['paths'] = {}
    const runtimePaths = runtimeSpec.paths ?? {}
    const staticPaths = staticSpec.paths ?? {}

    for (const [runtimePath, runtimeOperations] of Object.entries(runtimePaths)) {
      const mergedOperations: Partial<Record<RepoOpenApiOperationMethod, RepoOpenApiOperation>> = {}

      for (const [rawMethod, runtimeOperation] of Object.entries(runtimeOperations ?? {})) {
        const method = rawMethod as RepoOpenApiOperationMethod
        if (!runtimeOperation) continue

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

        if (!staticOperation) continue

        const runtimeMatch = this.findRuntimePathForStatic(staticPath, method, runtimePaths)

        if (runtimeMatch) continue
        if (!mergedPaths[staticPath]) mergedPaths[staticPath] = {}

        mergedPaths[staticPath][method] = staticOperation
      }
    }

    const runtimeSchemas = runtimeSpec.components?.schemas ?? {}
    const staticSchemas = staticSpec.components?.schemas ?? {}
    const mergedSchemas = { ...staticSchemas, ...runtimeSchemas }

    const mergedTags = this.mergeTagValues(runtimeSpec.tags?.map(tag => tag.name), staticSpec.tags?.map(tag => tag.name)).map(name => ({ name }))

    const staticOperationCount = this.countOpenApiOperations(staticPaths)
    const runtimeOperationCount = this.countOpenApiOperations(runtimePaths)
    const mergedOperationCount = this.countOpenApiOperations(mergedPaths)
    const operationsWithCodeSource = this.countOperationsWithCodeSource(mergedPaths)
    const moduleTagCount = mergedTags.length > 0 ? mergedTags.length : runtimeSpec.tags?.length ?? 0
    const schemaComponentCount = Object.keys(mergedSchemas).length
    const sourceMode = runtimeOperationCount > 0
      ? (staticOperationCount > 0 ? RepoOpenApiSourceMode.HYBRID : RepoOpenApiSourceMode.RUNTIME)
      : RepoOpenApiSourceMode.STATIC

    return {
      components: Object.keys(mergedSchemas).length > 0 ? { schemas: mergedSchemas } : undefined,
      info: runtimeSpec.info?.title ? runtimeSpec.info : staticSpec.info,
      openapi: OpenApiVersion.V3_1_0,
      paths: mergedPaths,
      tags: mergedTags.length > 0 ? mergedTags : runtimeSpec.tags,
      'x-codepath-metrics': {
        codeSourceCoverage: this.toRatio(operationsWithCodeSource, mergedOperationCount),
        mergedOperationCount,
        moduleTagCount,
        operationCount: mergedOperationCount,
        operationsWithCodeSource,
        runtimeOperationCount,
        runtimeResolvedUrl,
        schemaComponentCount,
        sourceMode,
        staticOperationCount
      }
    }
  }

  normalizeRuntimeOpenApiDocument(input: unknown): Nullable<RepoOpenApiDocument> {
    if (!input || typeof input !== 'object') return null

    const raw = input as Record<string, unknown>
    const rawPaths = raw.paths
    const infoRaw = raw.info && typeof raw.info === 'object' ? raw.info as Record<string, unknown> : {}

    if (!rawPaths || typeof rawPaths !== 'object' || Array.isArray(rawPaths)) return null

    const rawOpenApi = typeof raw.openapi === 'string' ? raw.openapi : ''
    const rawSwagger = typeof raw.swagger === 'string' ? raw.swagger : ''

    if (!rawOpenApi.startsWith('3.') && !rawSwagger.startsWith('2.')) return null

    const runtimeTags = Array.isArray(raw.tags) ? raw.tags.map(item => {
      if (!item || typeof item !== 'object') return null

      const name = (item as Record<string, unknown>).name
      return typeof name === 'string' && name.trim() ? { name: name.trim() } : null
    }).filter((value): value is { name: string } => value !== null) : undefined

    const componentsRaw = raw.components && typeof raw.components === 'object' ? raw.components as Record<string, unknown> : undefined
    const schemasRaw = componentsRaw?.schemas && typeof componentsRaw.schemas === 'object' && !Array.isArray(componentsRaw.schemas) ? componentsRaw.schemas as Record<string, RepoOpenApiSchema> : undefined

    return {
      components: schemasRaw ? { schemas: schemasRaw } : undefined,
      info: {
        description: typeof infoRaw.description === 'string' ? infoRaw.description : '',
        title: typeof infoRaw.title === 'string' ? infoRaw.title : 'Runtime OpenAPI',
        version: typeof infoRaw.version === 'string' ? infoRaw.version : '0.1.0'
      },
      openapi: OpenApiVersion.V3_1_0,
      paths: raw.paths as RepoOpenApiDocument['paths'],
      tags: runtimeTags
    }
  }

  private buildPathMatchCandidates(path: string) {
    const normalized = normalizeHttpPath(path)
    const candidates = new Set<string>([normalized])

    if (normalized.startsWith('/api/')) candidates.add(normalizeHttpPath(normalized.slice(4)))
    else if (normalized === '/api') candidates.add('/')
    else candidates.add(normalizeHttpPath(`/api${normalized}`))

    return [...candidates]
  }

  private countOpenApiOperations(paths: RepoOpenApiDocument['paths']) {
    let total = 0
    for (const operations of Object.values(paths)) {
      for (const method of SUPPORTED_OPENAPI_METHODS) {
        if (operations?.[method]) total += 1
      }
    }

    return total
  }

  private countOperationsWithCodeSource(paths: RepoOpenApiDocument['paths']) {
    let total = 0

    for (const operations of Object.values(paths)) {
      for (const method of SUPPORTED_OPENAPI_METHODS) {
        const operation = operations?.[method]

        if (!operation) continue

        if (operation['x-codepath'] || (operation['x-codepath-sources']?.length ?? 0) > 0) total += 1
      }
    }

    return total
  }

  private findRuntimePathForStatic(staticPath: string, method: RepoOpenApiOperationMethod, runtimePaths: RepoOpenApiDocument['paths']): Nullable<string> {
    const candidates = this.buildPathMatchCandidates(staticPath)

    for (const candidate of candidates) {
      const operation = runtimePaths[candidate]?.[method]

      if (operation) return candidate
    }

    return null
  }

  private findStaticOperationForRuntimePath(staticPaths: RepoOpenApiDocument['paths'], runtimePath: string, method: RepoOpenApiOperationMethod): Nullable<RepoOpenApiOperation> {
    const candidates = this.buildPathMatchCandidates(runtimePath)

    for (const candidate of candidates) {
      const operation = staticPaths[candidate]?.[method]

      if (operation) return operation
    }

    return null
  }

  private mergeOperationSources(existing: RepoOpenApiOperation, nextOperation: RepoOpenApiOperation): RepoOpenApiSourceMetadata[] {
    const allSources: RepoOpenApiSourceMetadata[] = []

    if (existing['x-codepath']) allSources.push(existing['x-codepath'])
    if (existing['x-codepath-sources']) allSources.push(...existing['x-codepath-sources'])
    if (nextOperation['x-codepath']) allSources.push(nextOperation['x-codepath'])

    const unique = new Map<string, RepoOpenApiSourceMetadata>()

    for (const source of allSources) {
      const key = `${source.framework}:${source.filePath}:${source.symbolName ?? ''}`

      unique.set(key, source)
    }

    return [...unique.values()]
  }

  private mergeTagValues(...tagsLists: Array<Undefinable<Array<string>>>) {
    return Array.from(
      new Set(tagsLists.flatMap(list => list ?? []).map(value => value.trim()).filter(Boolean))
    )
  }

  private normalizeTypeName(value: unknown): Undefinable<string> {
    if (typeof value !== 'string') return undefined

    const normalized = value.trim()
      .split(/[\s<>\[\],|]/)[0]
      ?.replace(/^.*\./, '')
      ?.replace(/[^A-Za-z0-9_]/g, '')

    if (!normalized || normalized.length === 0) {
      return undefined
    }

    return normalized
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
    const parameters: RepoOpenApiParameter[] = endpoint.params.filter(
      (param): param is RepoApiEndpoint['params'][number] & {
        location: RepoApiParameterLocation.HEADER | RepoApiParameterLocation.PATH | RepoApiParameterLocation.QUERY
      } => param.location !== RepoApiParameterLocation.BODY
    ).map(param => ({
      in: this.toOpenApiParameterIn(param.location),
      name: param.name,
      required: param.location === RepoApiParameterLocation.PATH ? true : param.required,
      schema: { type: RepoOpenApiSchemaType.STRING }
    }))

    const bodyParams = endpoint.params.filter(param => param.location === RepoApiParameterLocation.BODY)

    const bodyProperties = Object.fromEntries(
      bodyParams.map(param => [
        param.name === 'body' ? 'payload' : param.name,
        { type: RepoOpenApiSchemaType.STRING }
      ])
    )

    const requiredBodyProperties = bodyParams
      .filter(param => param.required)
      .map(param => param.name === 'body' ? 'payload' : param.name)

    const requestBodyTypeName = this.normalizeTypeName(endpoint.requestBodyTypeName)

    const operation: RepoOpenApiOperation = {
      operationId: this.toOperationId(endpoint),
      responses: { '200': { description: 'Successful response' } },
      summary: `${endpoint.method} ${openApiPath}`,
      tags: [endpoint.moduleName || endpoint.framework],
      'x-codepath': this.sourceFromEndpoint(endpoint)
    }

    if (parameters.length > 0) operation.parameters = parameters

    if (bodyParams.length > 0 || (requestBodyTypeName && schemaRegistry[requestBodyTypeName])) {
      const schema = requestBodyTypeName && schemaRegistry[requestBodyTypeName]
        ? { $ref: `#/components/schemas/${requestBodyTypeName}` }
        : {
          additionalProperties: true,
          properties: bodyProperties,
          required: requiredBodyProperties.length > 0 ? requiredBodyProperties : undefined,
          type: RepoOpenApiSchemaType.OBJECT
        }

      operation.requestBody = {
        content: { 'application/json': { schema } },
        required: requestBodyTypeName ? true : requiredBodyProperties.length > 0
      }
    }

    return operation
  }

  private toOpenApiParameterIn(location: RepoApiParameterLocation): RepoOpenApiParameterIn {
    if (location === RepoApiParameterLocation.HEADER) return RepoOpenApiParameterIn.HEADER
    if (location === RepoApiParameterLocation.PATH) return RepoOpenApiParameterIn.PATH

    return RepoOpenApiParameterIn.QUERY
  }

  private toOpenApiPath(path: string) {
    return normalizeHttpPath(path)
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

    const symbolPart = endpoint.symbolName ? endpoint.symbolName.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') : 'handler'

    return `${methodPart}_${pathPart}_${filePart}_${symbolPart}`
  }

  private toRatio(value: number, total: number) {
    if (total <= 0) return 0

    return Number((value / total).toFixed(4))
  }
}
