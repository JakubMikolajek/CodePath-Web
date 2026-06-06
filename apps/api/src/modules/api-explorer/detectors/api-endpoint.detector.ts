import type {
  RepoApiEndpoint,
  RepoApiEndpointParameter,
  RepoOpenApiSchema
} from '@workspace/codepath-common/api-explorer'
import {
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoApiParameterLocation
} from '@workspace/codepath-common/api-explorer'

import { ApiSchemaExtractor } from '../extractors/api-schema.extractor'
import type { CanonicalApiFile, SourceContext } from '../types/api-explorer-internal.types'

const SUPPORTED_METHODS: RepoApiHttpMethod[] = [
  RepoApiHttpMethod.DELETE,
  RepoApiHttpMethod.GET,
  RepoApiHttpMethod.HEAD,
  RepoApiHttpMethod.OPTIONS,
  RepoApiHttpMethod.PATCH,
  RepoApiHttpMethod.POST,
  RepoApiHttpMethod.PUT
]

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

export class ApiEndpointDetector {
  private readonly schemaExtractor = new ApiSchemaExtractor()

  detectEndpointsForFile(file: CanonicalApiFile) {
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

  extractSchemasFromFile(file: CanonicalApiFile): Record<string, RepoOpenApiSchema> {
    return this.schemaExtractor.extractSchemasFromContent(file.content)
  }

  private addPathParameters(params: RepoApiEndpointParameter[], path: string) {
    for (const name of parsePathParamNames(path)) {
      this.pushParam(params, {
        location: RepoApiParameterLocation.PATH,
        name,
        required: true
      })
    }
  }

  private assertMethod(value: string): null | RepoApiHttpMethod {
    const method = value.trim().toUpperCase() as RepoApiHttpMethod
    return SUPPORTED_METHODS.includes(method) ? method : null
  }

  private createEndpoint(
    file: CanonicalApiFile,
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

  private detectDjangoRoutes(file: CanonicalApiFile) {
    if (!file.content.includes('django') || !file.content.includes('path(')) {
      return [] as RepoApiEndpoint[]
    }

    const endpoints: RepoApiEndpoint[] = []
    for (const match of file.content.matchAll(/\b(?:re_)?path\s*\(\s*['"`]([^'"`]+)['"`]/g)) {
      const path = this.normalizeHttpPath(match[1] ?? '/')
      const params: RepoApiEndpointParameter[] = []
      const sourceContext = this.readSourceContext(file.content, match.index ?? 0, 360)
      this.addPathParameters(params, path)
      endpoints.push(this.createEndpoint(file, RepoApiFramework.DJANGO, RepoApiHttpMethod.GET, path, params, { sourceContext }))
    }

    return endpoints
  }

  private detectExpressRoutes(file: CanonicalApiFile) {
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
          location: RepoApiParameterLocation.PATH,
          name: reqParamMatch[1] ?? 'param',
          required: true
        })
      }

      for (const reqParamMatch of sourceContext.snippet.matchAll(/\breq\.query\.([A-Za-z0-9_]+)/g)) {
        this.pushParam(params, {
          location: RepoApiParameterLocation.QUERY,
          name: reqParamMatch[1] ?? 'query',
          required: false
        })
      }

      for (const reqParamMatch of sourceContext.snippet.matchAll(/\breq\.body\.([A-Za-z0-9_]+)/g)) {
        this.pushParam(params, {
          location: RepoApiParameterLocation.BODY,
          name: reqParamMatch[1] ?? 'body',
          required: false
        })
      }

      endpoints.push(this.createEndpoint(file, RepoApiFramework.EXPRESS, method, path, params, { sourceContext }))
    }

    return endpoints
  }

  private detectFastApiRoutes(file: CanonicalApiFile) {
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
          ? RepoApiParameterLocation.QUERY
          : locationToken === 'path'
            ? RepoApiParameterLocation.PATH
            : locationToken === 'header'
              ? RepoApiParameterLocation.HEADER
              : RepoApiParameterLocation.BODY

        this.pushParam(params, {
          location,
          name: paramMatch[1] ?? 'param',
          required: location === RepoApiParameterLocation.PATH
        })
      }

      const requestBodyTypeName = this.extractFastApiBodyTypeFromSnippet(sourceContext.snippet, path)
      endpoints.push(this.createEndpoint(file, RepoApiFramework.FASTAPI, method, path, params, {
        requestBodyTypeName,
        sourceContext
      }))
    }

    return endpoints
  }

  private detectFlaskRoutes(file: CanonicalApiFile) {
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
      endpoints.push(this.createEndpoint(file, RepoApiFramework.FLASK, method, path, params, { sourceContext }))
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

      const methods: RepoApiHttpMethod[] = methodsFromLiteral.length > 0 ? methodsFromLiteral : [RepoApiHttpMethod.GET]
      for (const method of methods) {
        endpoints.push(this.createEndpoint(file, RepoApiFramework.FLASK, method, path, params, { sourceContext }))
      }
    }

    return endpoints
  }

  private detectNestRoutes(file: CanonicalApiFile) {
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
      const sourceContext = this.readNestRouteSourceContext(file.content, match.index ?? 0)
      const symbolName = this.extractSymbolNameFromSnippet(sourceContext.snippet)

      const params: RepoApiEndpointParameter[] = []
      this.addPathParameters(params, routePath)

      for (const paramMatch of sourceContext.snippet.matchAll(/@Param\s*\(\s*['"`]([A-Za-z0-9_:-]+)['"`]/g)) {
        this.pushParam(params, {
          location: RepoApiParameterLocation.PATH,
          name: paramMatch[1] ?? 'param',
          required: true
        })
      }

      for (const paramMatch of sourceContext.snippet.matchAll(/@Query\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g)) {
        this.pushParam(params, {
          location: RepoApiParameterLocation.QUERY,
          name: paramMatch[1] ?? 'query',
          required: false
        })
      }

      for (const paramMatch of sourceContext.snippet.matchAll(/@Headers\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/g)) {
        this.pushParam(params, {
          location: RepoApiParameterLocation.HEADER,
          name: paramMatch[1] ?? 'header',
          required: false
        })
      }

      if (/@Body\s*\(/.test(sourceContext.snippet)) {
        const namedBodyMatch = sourceContext.snippet.match(/@Body\s*\(\s*['"`]([A-Za-z0-9_.-]+)['"`]/)
        this.pushParam(params, {
          location: RepoApiParameterLocation.BODY,
          name: namedBodyMatch?.[1] ?? 'body',
          required: false
        })
      }

      const requestBodyTypeName = this.extractNestBodyTypeFromSnippet(sourceContext.snippet)
      for (const controllerPrefix of uniqueControllerPrefixes) {
        const path = this.joinHttpPath(controllerPrefix, routePath)
        endpoints.push(this.createEndpoint(file, RepoApiFramework.NESTJS, method, path, params, {
          requestBodyTypeName,
          sourceContext,
          symbolName
        }))
      }
    }

    return endpoints
  }

  private extractFastApiBodyTypeFromSnippet(snippet: string, path: string): string | undefined {
    const pathParamNames = new Set(parsePathParamNames(path))
    const typedParamPattern = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([A-Za-z_][A-Za-z0-9_.[\],<>| ]*)\s*(?:=\s*([^,\n)]+))?/g

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

      const typeName = this.extractModelTypeName(rawType)
      if (!typeName || this.isPrimitiveTypeName(typeName)) {
        continue
      }

      return typeName
    }

    return undefined
  }

  private extractModelTypeName(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined
    }

    const raw = value.trim()
    if (!raw) {
      return undefined
    }

    const candidates = new Set<string>()
    candidates.add(raw)

    for (const unionPart of raw.split('|')) {
      const trimmed = unionPart.trim()
      if (trimmed) {
        candidates.add(trimmed)
      }
    }

    const genericMatch = raw.match(
      /^(?:typing\.)?(?:Optional|Union|List|Sequence|Array|Nullable)\s*[\[<]([\s\S]+)[\]>]\s*$/
    )
    if (genericMatch?.[1]) {
      for (const part of genericMatch[1].split(',')) {
        const trimmed = part.trim()
        if (trimmed) {
          candidates.add(trimmed)
        }
      }
    }

    for (const candidate of candidates) {
      const normalized = this.normalizeTypeName(candidate)
      if (!normalized || this.isPrimitiveTypeName(normalized)) {
        continue
      }

      return normalized
    }

    return undefined
  }

  private extractNestBodyTypeFromSnippet(snippet: string): string | undefined {
    const match = snippet.match(
      /@Body\s*\([^)]*\)\s*(?:public\s+|private\s+|protected\s+|readonly\s+)?[A-Za-z_][A-Za-z0-9_]*\s*:\s*([^=,\n)]+)/
    )

    return this.extractModelTypeName(match?.[1])
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

  private isPrimitiveTypeName(typeName: string) {
    return new Set([
      'Any',
      'Dict',
      'List',
      'Null',
      'None',
      'Record',
      'Optional',
      'Union',
      'array',
      'bool',
      'boolean',
      'dict',
      'double',
      'float',
      'int',
      'integer',
      'null',
      'number',
      'object',
      'str',
      'string',
      'undefined',
      'unknown',
      'void'
    ]).has(typeName)
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

  private pushParam(params: RepoApiEndpointParameter[], nextParam: RepoApiEndpointParameter) {
    if (params.some(param => param.location === nextParam.location && param.name === nextParam.name)) {
      return
    }

    params.push(nextParam)
  }

  private readNestRouteSourceContext(content: string, start: number): SourceContext {
    const safeStart = Math.max(0, start)
    const fallback = this.readSourceContext(content, safeStart, 500)
    const tail = content.slice(safeStart)
    const nextDecoratorPattern = /\n\s*@(Get|Post|Put|Patch|Delete|Options|Head|All)\s*\(/g
    nextDecoratorPattern.lastIndex = 1
    const nextDecoratorMatch = nextDecoratorPattern.exec(tail)
    const snippetEnd = nextDecoratorMatch
      ? safeStart + nextDecoratorMatch.index
      : Math.min(content.length, safeStart + 900)
    const snippet = content.slice(safeStart, snippetEnd).trim()

    if (!snippet) {
      return fallback
    }

    return {
      lineStart: content.slice(0, safeStart).split('\n').length,
      snippet
    }
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
}
