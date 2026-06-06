'use client'

import type {
  RepoApiEndpoint,
  RepoApiRunnerAuthPreset,
  RepoApiRunnerCollection,
  RepoApiRunnerCollectionConfig,
  RepoApiRunnerResponse,
  RepoInteractiveApi
} from '@workspace/codepath-common/api-explorer'
import {
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoApiParameterLocation,
  RepoApiRunnerApiKeyPlacement,
  RepoApiRunnerAuthMode
} from '@workspace/codepath-common/api-explorer'
import type { Nullable } from '@workspace/codepath-common/globals'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'
import { Download, Filter, RefreshCw, RotateCcw, Search } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import {
  createDefaultRunnerAuthConfig,
  deleteRepoRunnerAuthPreset,
  deleteRepoRunnerCollection,
  getRepoInteractiveApi,
  getRepoInteractiveApiJson,
  getRepoOpenApiSpec,
  listRepoRunnerAuthPresets,
  listRepoRunnerCollections,
  runRepoApiRequest,
  saveRepoRunnerAuthPreset,
  saveRepoRunnerCollection
} from '@/lib/api-explorer'
import { getFirstRouteParam } from '@/lib/route-params'

const FRAMEWORK_OPTIONS: RepoApiFramework[] = [
  RepoApiFramework.DJANGO,
  RepoApiFramework.EXPRESS,
  RepoApiFramework.FASTAPI,
  RepoApiFramework.FLASK,
  RepoApiFramework.NESTJS,
  RepoApiFramework.UNKNOWN
]

const METHOD_OPTIONS: RepoApiHttpMethod[] = [
  RepoApiHttpMethod.DELETE,
  RepoApiHttpMethod.GET,
  RepoApiHttpMethod.HEAD,
  RepoApiHttpMethod.OPTIONS,
  RepoApiHttpMethod.PATCH,
  RepoApiHttpMethod.POST,
  RepoApiHttpMethod.PUT
]

const METHOD_WITH_BODY = new Set<RepoApiHttpMethod>([
  RepoApiHttpMethod.PATCH,
  RepoApiHttpMethod.POST,
  RepoApiHttpMethod.PUT
])

const methodClasses: Record<RepoApiHttpMethod, string> = {
  [RepoApiHttpMethod.DELETE]: 'border-red-400/40 bg-red-400/10 text-red-200',
  [RepoApiHttpMethod.GET]: 'border-cyan-300/40 bg-cyan-300/10 text-cyan-200',
  [RepoApiHttpMethod.HEAD]: 'border-slate-300/30 bg-slate-300/10 text-slate-200',
  [RepoApiHttpMethod.OPTIONS]: 'border-zinc-300/30 bg-zinc-300/10 text-zinc-200',
  [RepoApiHttpMethod.PATCH]: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  [RepoApiHttpMethod.POST]: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200',
  [RepoApiHttpMethod.PUT]: 'border-violet-300/40 bg-violet-300/10 text-violet-200'
}

const fieldClassName = 'h-11 rounded-xl border-input bg-input/70 px-4 text-sm text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.05)] transition-[border-color,box-shadow,background,color] focus-visible:border-ring focus-visible:bg-input focus-visible:ring-[3px] focus-visible:ring-ring/50'
const runnerPanelClassName = 'space-y-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4'

const resolveErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const responseData = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message

    if (Array.isArray(responseData)) return responseData.join(', ')
    if (typeof responseData === 'string') return responseData
  }

  if (error instanceof Error) return error.message

  return 'Unexpected error'
}

const hashString = (value: string) => {
  let hash = 0

  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }

  return Math.abs(hash)
}

const parsePathParamNames = (path: string) => {
  const names: string[] = []

  for (const match of path.matchAll(/:([A-Za-z0-9_]+)/g)) {
    if (match[1]) names.push(match[1])
  }

  for (const match of path.matchAll(/\{([A-Za-z0-9_]+)(?::[^}]+)?}/g)) {
    if (match[1]) names.push(match[1])
  }

  for (const match of path.matchAll(/<(?:[A-Za-z0-9_]+:)?([A-Za-z0-9_]+)>/g)) {
    if (match[1]) names.push(match[1])
  }

  return Array.from(new Set(names))
}

const generateSampleValue = (name: string, seed: string) => {
  const lowered = name.trim().toLowerCase()
  const deterministic = hashString(`${seed}:${lowered}`)

  if (lowered.includes('uuid')) return '550e8400-e29b-41d4-a716-446655440000'
  if (lowered.includes('email')) return `user${deterministic % 100}@example.com`
  if (lowered.includes('phone')) return `+4812345${String(deterministic % 10_000).padStart(4, '0')}`
  if (lowered.includes('date')) return '2026-01-01'
  if (lowered.includes('time')) return '2026-01-01T10:00:00.000Z'
  if (lowered.includes('token')) return `token-${deterministic.toString(16)}`
  if (lowered.includes('price') || lowered.includes('amount') || lowered.includes('total')) return Number(((deterministic % 20000) / 100).toFixed(2))
  if (lowered.includes('count') || lowered.includes('limit') || lowered.includes('page') || lowered.includes('offset')) return (deterministic % 50) + 1
  if (lowered.includes('active') || lowered.includes('enabled') || lowered.startsWith('is')) return deterministic % 2 === 0
  if (lowered === 'id' || lowered.endsWith('_id') || lowered.endsWith('id')) return (deterministic % 9000) + 1000
  if (lowered.includes('name')) return `sample-${lowered}-${deterministic % 100}`

  return `sample-${lowered || 'value'}-${deterministic % 1000}`
}

const parseJsonObjectInput = (raw: string, label: string) => {
  try {
    const parsed = JSON.parse(raw)

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object`)

    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error) throw new Error(`${label}: ${error.message}`)

    throw new Error(`${label}: invalid JSON`)
  }
}

const parseJsonInput = (raw: string, label: string) => {
  try {
    return JSON.parse(raw)
  } catch (error) {
    if (error instanceof Error) throw new Error(`${label}: ${error.message}`)

    throw new Error(`${label}: invalid JSON`)
  }
}

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) throw new Error('Base URL is required')

  try {
    const parsed = new URL(trimmed)

    return parsed.toString()
  } catch {
    throw new Error('Base URL is invalid')
  }
}

const resolvePathTemplate = (template: string, pathParams: Record<string, string>) => {
  let resolved = template

  for (const [name, value] of Object.entries(pathParams)) {
    const encoded = encodeURIComponent(value)

    resolved = resolved
      .replace(new RegExp(`:${name}(?=/|$)`, 'g'), encoded)
      .replace(new RegExp(`\\{${name}(?::[^}]*)?\\}`, 'g'), encoded)
      .replace(new RegExp(`<(?:[A-Za-z0-9_]+:)?${name}>`, 'g'), encoded)
  }

  return resolved
}

const buildRunnerUrl = (baseUrl: string, path: string, query: Record<string, unknown>) => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const finalUrl = new URL(path.startsWith('/') ? path : `/${path}`, normalizedBaseUrl)

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue

    if (Array.isArray(value)) {
      for (const item of value) {
        finalUrl.searchParams.append(key, String(item))
      }

      continue
    }

    if (typeof value === 'object') {
      finalUrl.searchParams.set(key, JSON.stringify(value))

      continue
    }

    finalUrl.searchParams.set(key, String(value))
  }

  return finalUrl.toString()
}

const buildAuthArtifacts = (auth: RepoApiRunnerCollectionConfig['auth']) => {
  const headers: Record<string, string> = {}
  const query: Record<string, string> = {}

  if (auth.mode === RepoApiRunnerAuthMode.BEARER) {
    if (!auth.bearerToken.trim()) throw new Error('Bearer token is required')

    headers.Authorization = `Bearer ${auth.bearerToken.trim()}`
  }

  if (auth.mode === RepoApiRunnerAuthMode.BASIC) {
    const username = auth.basicUsername.trim()
    const password = auth.basicPassword

    if (!username) throw new Error('Basic username is required')

    const encoded = window.btoa(`${username}:${password}`)

    headers.Authorization = `Basic ${encoded}`
  }

  if (auth.mode === RepoApiRunnerAuthMode.API_KEY) {
    const keyName = auth.apiKeyName.trim()
    const keyValue = auth.apiKeyValue.trim()

    if (!keyName) throw new Error('API key name is required')

    if (!keyValue) throw new Error('API key value is required')

    if (auth.apiKeyPlacement === RepoApiRunnerApiKeyPlacement.QUERY) query[keyName] = keyValue
    else headers[keyName] = keyValue
  }

  return { headers, query }
}

function EndpointRow({ endpoint, isActive, onUse }: {
  endpoint: RepoApiEndpoint
  isActive: boolean
  onUse: (endpoint: RepoApiEndpoint) => void
}) {
  return (
    <tr className={`border-b border-white/10 transition hover:bg-white/4 ${isActive ? 'bg-primary/10' : ''}`}>
      <td className="px-3 py-2 align-top">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${methodClasses[endpoint.method]}`}>
          {endpoint.method}
        </span>
      </td>

      <td className="px-3 py-2 align-top font-mono text-xs">{endpoint.path}</td>

      <td className="px-3 py-2 align-top text-sm">{endpoint.framework}</td>

      <td className="px-3 py-2 align-top text-sm">{endpoint.moduleName ?? '-'}</td>

      <td className="px-3 py-2 align-top font-mono text-xs">{endpoint.filePath}</td>

      <td className="px-3 py-2 align-top text-xs">
        {endpoint.params.length === 0 ? (
          <span className="text-muted-foreground">-</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {endpoint.params.map(param => (
              <span
                className="rounded-full border border-white/10 bg-white/4 px-2 py-0.5"
                key={`${endpoint.id}:${param.location}:${param.name}`}
              >
                {param.location}:{param.name}{param.required ? '*' : ''}
              </span>
            ))}
          </div>
        )}
      </td>

      <td className="px-3 py-2 align-top text-xs">
        {endpoint.sourceSnippet ? (
          <details>
            <summary className="cursor-pointer text-primary">
              Show code{endpoint.sourceLineStart ? ` (L${endpoint.sourceLineStart})` : ''}
            </summary>

            <pre className="mt-2 max-h-44 overflow-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {endpoint.sourceSnippet}
            </pre>
          </details>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>

      <td className="px-3 py-2 align-top">
        <button
          className={`rounded-full border px-3 py-1.5 text-xs transition ${isActive ? 'border-primary/60 bg-primary/15 text-primary' : 'border-white/10 bg-white/3 text-muted-foreground hover:border-primary/40 hover:text-white'}`}
          onClick={() => onUse(endpoint)}
          type="button"
        >
          {isActive ? 'Selected' : 'Use in runner'}
        </button>
      </td>
    </tr>
  )
}

export default function Page() {
  const params = useParams()

  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const [data, setData] = useState<Nullable<RepoInteractiveApi>>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [exportingEndpoints, setExportingEndpoints] = useState<boolean>(false)
  const [exportingOpenApi, setExportingOpenApi] = useState<boolean>(false)
  const [error, setError] = useState<Nullable<string>>(null)
  const [search, setSearch] = useState<string>('')
  const [runtimeOpenApiBaseUrl, setRuntimeOpenApiBaseUrl] = useState<string>('')
  const [selectedMethods, setSelectedMethods] = useState<RepoApiHttpMethod[]>([])
  const [selectedFrameworks, setSelectedFrameworks] = useState<RepoApiFramework[]>([])
  const [baseUrl, setBaseUrl] = useState<string>('http://127.0.0.1:3000')
  const [timeoutMs, setTimeoutMs] = useState<number>(10_000)
  const [selectedEndpoint, setSelectedEndpoint] = useState<Nullable<RepoApiEndpoint>>(null)
  const [pathValues, setPathValues] = useState<Record<string, string>>({})
  const [queryJson, setQueryJson] = useState<string>('{}')
  const [bodyJson, setBodyJson] = useState<string>('{}')
  const [headersJson, setHeadersJson] = useState<string>('{\n  "Accept": "application/json"\n}')
  const [runningRequest, setRunningRequest] = useState<boolean>(false)
  const [runnerError, setRunnerError] = useState<Nullable<string>>(null)
  const [runnerResult, setRunnerResult] = useState<Nullable<RepoApiRunnerResponse>>(null)
  const [auth, setAuth] = useState<RepoApiRunnerCollectionConfig['auth']>(createDefaultRunnerAuthConfig())
  const [runnerAuthPresets, setRunnerAuthPresets] = useState<RepoApiRunnerAuthPreset[]>([])
  const [authPresetNameInput, setAuthPresetNameInput] = useState<string>('')
  const [runnerCollections, setRunnerCollections] = useState<RepoApiRunnerCollection[]>([])
  const [collectionNameInput, setCollectionNameInput] = useState<string>('')

  const loadExplorer = useCallback(async () => {
    if (!Number.isFinite(repoId)) {
      setError('Invalid repository identifier')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await getRepoInteractiveApi(repoId, {
        frameworks: selectedFrameworks.length > 0 ? selectedFrameworks : undefined,
        methods: selectedMethods.length > 0 ? selectedMethods : undefined,
        search
      })

      setData(response)
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }, [repoId, search, selectedFrameworks, selectedMethods])

  useEffect(() => {
    void loadExplorer()
  }, [loadExplorer])

  const loadRunnerCollectionsFromServer = useCallback(async () => {
    if (!Number.isFinite(repoId)) return

    try {
      const collections = await listRepoRunnerCollections(repoId)
      setRunnerCollections(collections)
    } catch (nextError) {
      setRunnerError(resolveErrorMessage(nextError))
    }
  }, [repoId])

  useEffect(() => {
    void loadRunnerCollectionsFromServer()
  }, [loadRunnerCollectionsFromServer])

  const loadRunnerAuthPresetsFromServer = useCallback(async () => {
    if (!Number.isFinite(repoId)) return

    try {
      const presets = await listRepoRunnerAuthPresets(repoId)
      setRunnerAuthPresets(presets)
    } catch (nextError) {
      setRunnerError(resolveErrorMessage(nextError))
    }
  }, [repoId])

  useEffect(() => {
    void loadRunnerAuthPresetsFromServer()
  }, [loadRunnerAuthPresetsFromServer])

  const initializeRunnerForEndpoint = useCallback((endpoint: RepoApiEndpoint) => {
    const seed = endpoint.id
    const pathParamNames = new Set<string>([
      ...parsePathParamNames(endpoint.path),
      ...endpoint.params.filter(param => param.location === RepoApiParameterLocation.PATH).map(param => param.name)
    ])

    const nextPathValues: Record<string, string> = {}

    for (const name of pathParamNames) {
      nextPathValues[name] = String(generateSampleValue(name, seed))
    }

    const nextQuery: Record<string, unknown> = {}

    for (const param of endpoint.params.filter(param => param.location === RepoApiParameterLocation.QUERY)) {
      nextQuery[param.name] = generateSampleValue(param.name, seed)
    }

    const nextBody: Record<string, unknown> = {}

    for (const param of endpoint.params.filter(param => param.location === RepoApiParameterLocation.BODY)) {
      const key = param.name === 'body' ? 'payload' : param.name
      nextBody[key] = generateSampleValue(key, seed)
    }

    if (METHOD_WITH_BODY.has(endpoint.method) && Object.keys(nextBody).length === 0) nextBody.payload = `sample-${hashString(seed) % 1000}`

    const nextHeaders: Record<string, string> = {
      Accept: 'application/json'
    }

    if (METHOD_WITH_BODY.has(endpoint.method)) nextHeaders['Content-Type'] = 'application/json'

    setSelectedEndpoint(endpoint)
    setPathValues(nextPathValues)
    setQueryJson(JSON.stringify(nextQuery, null, 2))
    setBodyJson(JSON.stringify(nextBody, null, 2))
    setHeadersJson(JSON.stringify(nextHeaders, null, 2))
    setCollectionNameInput(`${endpoint.method} ${endpoint.path}`)
    setRunnerError(null)
    setRunnerResult(null)
  }, [])

  const toggleMethod = (method: RepoApiHttpMethod) => {
    setSelectedMethods(prev => prev.includes(method) ? prev.filter(value => value !== method) : [...prev, method])
  }

  const toggleFramework = (framework: RepoApiFramework) => {
    setSelectedFrameworks(prev => prev.includes(framework) ? prev.filter(value => value !== framework) : [...prev, framework])
  }

  const resetFilters = () => {
    setSearch('')
    setSelectedFrameworks([])
    setSelectedMethods([])
  }

  const handleSaveCollection = async () => {
    if (!Number.isFinite(repoId)) {
      setRunnerError('Invalid repository identifier')
      return
    }

    if (!selectedEndpoint) {
      setRunnerError('Select endpoint first')
      return
    }

    const name = collectionNameInput.trim()
    
    if (!name) {
      setRunnerError('Collection name is required')
      return
    }

    try {
      const saved = await saveRepoRunnerCollection(repoId, {
        name,
        config: {
          auth: { ...auth },
          baseUrl,
          bodyJson,
          endpointId: selectedEndpoint.id,
          endpointMethod: selectedEndpoint.method,
          endpointPath: selectedEndpoint.path,
          headersJson,
          pathValues: { ...pathValues },
          queryJson,
          timeoutMs
        }
      })

      setRunnerCollections(prev => [saved, ...prev.filter(collection => collection.id !== saved.id)])
      setRunnerError(null)
    } catch (nextError) {
      setRunnerError(resolveErrorMessage(nextError))
    }
  }

  const handleLoadCollection = (collection: RepoApiRunnerCollection) => {
    const endpoint = endpoints.find(item => item.id === collection.config.endpointId)
      ?? endpoints.find(item => item.method === collection.config.endpointMethod && item.path === collection.config.endpointPath)
      ?? null

    if (!endpoint) {
      setRunnerError(`Saved endpoint not found in current list: ${collection.config.endpointMethod ?? 'UNKNOWN'} ${collection.config.endpointPath ?? ''}`)
      return
    }

    setSelectedEndpoint(endpoint)
    setBaseUrl(collection.config.baseUrl)
    setTimeoutMs(collection.config.timeoutMs)
    setPathValues(collection.config.pathValues ?? {})
    setQueryJson(collection.config.queryJson)
    setBodyJson(collection.config.bodyJson)
    setHeadersJson(collection.config.headersJson)
    setAuth(collection.config.auth ?? createDefaultRunnerAuthConfig())
    setCollectionNameInput(collection.name)
    setRunnerError(null)
    setRunnerResult(null)
  }

  const handleDeleteCollection = async (collectionId: number) => {
    if (!Number.isFinite(repoId)) return

    try {
      await deleteRepoRunnerCollection(repoId, collectionId)
      setRunnerCollections(prev => prev.filter(collection => collection.id !== collectionId))
    } catch (nextError) {
      setRunnerError(resolveErrorMessage(nextError))
    }
  }

  const handleSaveAuthPreset = async () => {
    if (!Number.isFinite(repoId)) {
      setRunnerError('Invalid repository identifier')
      return
    }

    const name = authPresetNameInput.trim()
    
    if (!name) {
      setRunnerError('Auth preset name is required')
      return
    }

    try {
      const saved = await saveRepoRunnerAuthPreset(repoId, {
        config: { ...auth },
        name
      })

      setRunnerAuthPresets(prev => [saved, ...prev.filter(preset => preset.id !== saved.id)])
      setRunnerError(null)
    } catch (nextError) {
      setRunnerError(resolveErrorMessage(nextError))
    }
  }

  const handleLoadAuthPreset = (preset: RepoApiRunnerAuthPreset) => {
    setAuth({ ...preset.config })
    setAuthPresetNameInput(preset.name)
    setRunnerError(null)
  }

  const handleDeleteAuthPreset = async (presetId: number) => {
    if (!Number.isFinite(repoId)) return

    try {
      await deleteRepoRunnerAuthPreset(repoId, presetId)
      setRunnerAuthPresets(prev => prev.filter(preset => preset.id !== presetId))
    } catch (nextError) {
      setRunnerError(resolveErrorMessage(nextError))
    }
  }

  const handleExportOpenApi = async () => {
    if (!Number.isFinite(repoId)) {
      setError('Invalid repository identifier')
      return
    }

    setExportingOpenApi(true)
    setError(null)
    
    try {
      const spec = await getRepoOpenApiSpec(repoId, {
        frameworks: selectedFrameworks.length > 0 ? selectedFrameworks : undefined,
        methods: selectedMethods.length > 0 ? selectedMethods : undefined,
        runtimeBaseUrl: runtimeOpenApiBaseUrl,
        search
      })

      const json = JSON.stringify(spec, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')

      downloadLink.href = url
      downloadLink.download = `repo-${repoId}-openapi.json`

      document.body.appendChild(downloadLink)

      downloadLink.click()
      downloadLink.remove()

      URL.revokeObjectURL(url)
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setExportingOpenApi(false)
    }
  }

  const handleExportEndpointsJson = async () => {
    if (!Number.isFinite(repoId)) {
      setError('Invalid repository identifier')
      return
    }

    setExportingEndpoints(true)
    setError(null)

    try {
      const result = await getRepoInteractiveApiJson(repoId, {
        frameworks: selectedFrameworks.length > 0 ? selectedFrameworks : undefined,
        methods: selectedMethods.length > 0 ? selectedMethods : undefined,
        search
      })

      const json = JSON.stringify(result, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const downloadLink = document.createElement('a')

      downloadLink.href = url
      downloadLink.download = `repo-${repoId}-endpoints.json`

      document.body.appendChild(downloadLink)
      downloadLink.click()
      downloadLink.remove()

      URL.revokeObjectURL(url)
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setExportingEndpoints(false)
    }
  }

  const handleRunRequest = async () => {
    if (!Number.isFinite(repoId)) {
      setRunnerError('Invalid repository identifier')
      return
    }

    if (!selectedEndpoint) {
      setRunnerError('Select endpoint first')
      return
    }

    setRunningRequest(true)
    setRunnerError(null)
    setRunnerResult(null)

    try {
      const parsedQuery = parseJsonObjectInput(queryJson, 'Query JSON')
      const parsedHeaders = parseJsonObjectInput(headersJson, 'Headers JSON')
      const parsedBody = parseJsonInput(bodyJson, 'Body JSON')
      const resolvedPath = resolvePathTemplate(selectedEndpoint.path, pathValues)
      const authArtifacts = buildAuthArtifacts(auth)
      const url = buildRunnerUrl(baseUrl, resolvedPath, {
        ...parsedQuery,
        ...authArtifacts.query
      })

      const headers: Record<string, string> = {}

      for (const [key, value] of Object.entries(parsedHeaders)) {
        const normalizedKey = key.trim()

        if (!normalizedKey) continue

        headers[normalizedKey] = typeof value === 'string' ? value : JSON.stringify(value)
      }

      for (const [key, value] of Object.entries(authArtifacts.headers)) {
        headers[key] = value
      }

      const shouldSendBody = METHOD_WITH_BODY.has(selectedEndpoint.method)
      
      const response = await runRepoApiRequest(repoId, {
        body: shouldSendBody ? parsedBody : undefined,
        headers,
        method: selectedEndpoint.method,
        timeoutMs,
        url
      })

      setRunnerResult(response)
    } catch (nextError) {
      setRunnerError(resolveErrorMessage(nextError))
    } finally {
      setRunningRequest(false)
    }
  }

  const availableFrameworks = data?.metadata.frameworks ?? []
  const endpoints = data?.endpoints ?? []

  const runnerDataPreview = useMemo(() => {
    if (!runnerResult) return ''
    if (typeof runnerResult.data === 'string') return runnerResult.data

    return JSON.stringify(runnerResult.data, null, 2)
  }, [runnerResult])

  return (
    <div className="space-y-6">
      <PageHeader
        description="Explore detected backend endpoints, generated request payloads, OpenAPI exports and workspace-shared runner presets."
        eyebrow={`Repo ${Number.isFinite(repoId) ? repoId : 'unknown'}`}
        title="API Explorer"
      />

      <section aria-label="API explorer filters" className="glass-panel rounded-3xl p-4 md:p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
          <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="api-search">
            <span className="flex items-center gap-2 text-white">
              <Search className="size-4 text-cyan-300" />
              Search
            </span>

            <Input
              id="api-search"
              onChange={event => setSearch(event.target.value)}
              placeholder="path, file, method, framework..."
              value={search}
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium" htmlFor="runtime-openapi-base-url">
            <span className="text-white">Runtime OpenAPI Base URL (optional)</span>

            <Input
              id="runtime-openapi-base-url"
              onChange={event => setRuntimeOpenApiBaseUrl(event.target.value)}
              placeholder="http://127.0.0.1:3001"
              value={runtimeOpenApiBaseUrl}
            />

            <span className="text-xs font-normal text-muted-foreground">
              OpenAPI export is runtime-first from this URL, with static fallback from code.
            </span>
          </label>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Methods</p>

            <div className="flex flex-wrap gap-2 text-sm">
              {METHOD_OPTIONS.map(method => (
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${selectedMethods.includes(method) ? 'border-primary/50 bg-primary/15 text-white' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-primary/40 hover:text-white'}`}
                  key={method}
                >
                  <input
                    checked={selectedMethods.includes(method)}
                    className="size-3.5 accent-primary"
                    onChange={() => toggleMethod(method)}
                    type="checkbox"
                  />

                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${methodClasses[method]}`}>{method}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Frameworks</p>

            <div className="flex flex-wrap gap-2 text-sm">
              {FRAMEWORK_OPTIONS.map(framework => {
                const enabled = availableFrameworks.length === 0 || availableFrameworks.includes(framework)

                return (
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${selectedFrameworks.includes(framework) ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-cyan-300/30 hover:text-white'} ${enabled ? '' : 'opacity-40'}`}
                    key={framework}
                  >
                    <input
                      checked={selectedFrameworks.includes(framework)}
                      className="size-3.5 accent-primary"
                      onChange={() => toggleFramework(framework)}
                      type="checkbox"
                    />

                    <span>{framework}</span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <Button onClick={loadExplorer} type="button" variant="glow">
            <Filter className="size-4" />
            Apply filters
          </Button>

          <Button onClick={resetFilters} type="button" variant="glass">
            <RotateCcw className="size-4" />
            Reset
          </Button>

          <Button onClick={loadExplorer} type="button" variant="glass">
            <RefreshCw className="size-4" />
            Refresh
          </Button>

          <Button disabled={exportingEndpoints} onClick={handleExportEndpointsJson} type="button" variant="glass">
            <Download className="size-4" />
            {exportingEndpoints ? 'Exporting...' : 'Export Endpoints JSON'}
          </Button>

          <Button disabled={exportingOpenApi} onClick={handleExportOpenApi} type="button" variant="glass">
            <Download className="size-4" />
            {exportingOpenApi ? 'Exporting...' : 'Export OpenAPI JSON'}
          </Button>

          <span className="ml-auto text-xs text-muted-foreground">
            Endpoints: {data?.metadata.endpointCount ?? 0} | Segments scanned: {data?.metadata.segmentCount ?? 0}
          </span>
        </div>
      </section>

      <section aria-label="API runner" className="glass-panel rounded-3xl p-4 space-y-3 md:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">API Runner (MVP)</h2>

          {selectedEndpoint && (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedEndpoint.method} {selectedEndpoint.path}
            </p>
          )}
        </div>

        {selectedEndpoint?.sourceSnippet && (
          <details className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs">
            <summary className="cursor-pointer text-primary">
              Source fragment{selectedEndpoint.sourceLineStart ? ` (L${selectedEndpoint.sourceLineStart})` : ''}
            </summary>

            <pre className="mt-2 max-h-40 overflow-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
              {selectedEndpoint.sourceSnippet}
            </pre>
          </details>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Base URL</span>

            <input
              className={fieldClassName}
              onChange={event => setBaseUrl(event.target.value)}
              placeholder="http://127.0.0.1:3000"
              value={baseUrl}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span>Timeout (ms)</span>

            <input
              className={fieldClassName}
              min={1000}
              onChange={event => setTimeoutMs(Number(event.target.value))}
              type="number"
              value={timeoutMs}
            />
          </label>
        </div>

        <div className={runnerPanelClassName}>
          <p className="text-xs font-medium uppercase text-muted-foreground">Auth preset</p>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Mode</span>

              <select
                className={fieldClassName}
                onChange={event => setAuth(prev => ({ ...prev, mode: event.target.value as RepoApiRunnerAuthMode }))}
                value={auth.mode}
              >
                <option value={RepoApiRunnerAuthMode.NONE}>None</option>

                <option value={RepoApiRunnerAuthMode.BEARER}>Bearer token</option>

                <option value={RepoApiRunnerAuthMode.BASIC}>Basic auth</option>

                <option value={RepoApiRunnerAuthMode.API_KEY}>API key</option>
              </select>
            </label>
          </div>

          {auth.mode === RepoApiRunnerAuthMode.BEARER && (
            <label className="flex flex-col gap-1 text-sm">
              <span>Bearer token</span>

              <input
                className={fieldClassName}
                onChange={event => setAuth(prev => ({ ...prev, bearerToken: event.target.value }))}
                placeholder="eyJhbGciOi..."
                value={auth.bearerToken}
              />
            </label>
          )}

          {auth.mode === RepoApiRunnerAuthMode.BASIC && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span>Username</span>

                <input
                  className={fieldClassName}
                  onChange={event => setAuth(prev => ({ ...prev, basicUsername: event.target.value }))}
                  value={auth.basicUsername}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Password</span>

                <input
                  className={fieldClassName}
                  onChange={event => setAuth(prev => ({ ...prev, basicPassword: event.target.value }))}
                  type="password"
                  value={auth.basicPassword}
                />
              </label>
            </div>
          )}

          {auth.mode === RepoApiRunnerAuthMode.API_KEY && (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Key name</span>

                <input
                  className={fieldClassName}
                  onChange={event => setAuth(prev => ({ ...prev, apiKeyName: event.target.value }))}
                  value={auth.apiKeyName}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Key value</span>

                <input
                  className={fieldClassName}
                  onChange={event => setAuth(prev => ({ ...prev, apiKeyValue: event.target.value }))}
                  type="password"
                  value={auth.apiKeyValue}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Placement</span>

                <select
                  className={fieldClassName}
                  onChange={event => setAuth(prev => ({ ...prev, apiKeyPlacement: event.target.value as RepoApiRunnerApiKeyPlacement }))}
                  value={auth.apiKeyPlacement}
                >
                  <option value={RepoApiRunnerApiKeyPlacement.HEADER}>Header</option>

                  <option value={RepoApiRunnerApiKeyPlacement.QUERY}>Query</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <div className={runnerPanelClassName}>
          <p className="text-xs font-medium uppercase text-muted-foreground">Auth presets (workspace-shared)</p>
          <div className="flex flex-wrap gap-2">
            <input
              className={`${fieldClassName} min-w-55 flex-1`}
              onChange={event => setAuthPresetNameInput(event.target.value)}
              placeholder="Auth preset name"
              value={authPresetNameInput}
            />

            {/* FIXME create button component for that */}
            <button
              className="rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-white"
              onClick={handleSaveAuthPreset}
              type="button"
            >
              Save current auth
            </button>
          </div>

          {runnerAuthPresets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved auth presets for this repo yet.</p>
          ) : (
            <div className="max-h-44 overflow-auto space-y-1">
              {runnerAuthPresets.map(preset => (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2" key={preset.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{preset.name}</p>

                    <p className="truncate text-xs text-muted-foreground">
                      mode: {preset.config.mode}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    {/* FIXME create button component for that */}
                    <button
                      className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-white"
                      onClick={() => handleLoadAuthPreset(preset)}
                      type="button"
                    >
                      Load
                    </button>

                    {/* FIXME create button component for that */}
                    <button
                      className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-white"
                      onClick={() => handleDeleteAuthPreset(preset.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={runnerPanelClassName}>
          <p className="text-xs font-medium uppercase text-muted-foreground">Request collections (workspace-shared)</p>

          <div className="flex flex-wrap gap-2">
            <input
              className={`${fieldClassName} min-w-55 flex-1`}
              onChange={event => setCollectionNameInput(event.target.value)}
              placeholder="Collection name"
              value={collectionNameInput}
            />

            <button
              className="rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-white"
              onClick={handleSaveCollection}
              type="button"
            >
              Save current config
            </button>
          </div>

          {runnerCollections.length === 0 ? (
            <p className="text-xs text-muted-foreground">No saved collections for this repo yet.</p>
          ) : (
            <div className="max-h-52 overflow-auto space-y-1">
              {runnerCollections.map(collection => (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2" key={collection.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{collection.name}</p>

                    <p className="truncate text-xs text-muted-foreground">
                      {collection.config.endpointMethod ?? 'UNKNOWN'} {collection.config.endpointPath ?? ''}
                    </p>
                  </div>

                  <div className="flex gap-1">
                    {/* FIXME create button component for that */}
                    <button
                      className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-white"
                      onClick={() => handleLoadCollection(collection)}
                      type="button"
                    >
                      Load
                    </button>

                    <button
                      className="rounded-lg border border-white/10 bg-white/4 px-2.5 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-white"
                      onClick={() => handleDeleteCollection(collection.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedEndpoint ? (
          <>
            {Object.keys(pathValues).length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Path Params</p>

                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(pathValues).map(([name, value]) => (
                    <label className="flex flex-col gap-1 text-sm" key={name}>
                      <span>{name}</span>

                      <input
                        className={fieldClassName}
                        onChange={event => setPathValues(prev => ({ ...prev, [name]: event.target.value }))}
                        value={value}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Query JSON</span>

                <Textarea
                  className="h-40 font-mono text-xs"
                  onChange={event => setQueryJson(event.target.value)}
                  value={queryJson}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Body JSON</span>

                <Textarea
                  className="h-40 font-mono text-xs"
                  onChange={event => setBodyJson(event.target.value)}
                  value={bodyJson}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span>Headers JSON</span>

                <Textarea
                  className="h-40 font-mono text-xs"
                  onChange={event => setHeadersJson(event.target.value)}
                  value={headersJson}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => initializeRunnerForEndpoint(selectedEndpoint)}
                type="button"
                variant="glass"
              >
                Regenerate test payload
              </Button>

              <Button
                disabled={runningRequest}
                onClick={handleRunRequest}
                type="button"
                variant="glow"
              >
                {runningRequest ? 'Sending...' : 'Send request'}
              </Button>
            </div>

            {runnerError && (
              <p className="text-sm text-red-500">{runnerError}</p>
            )}

            {runnerResult && (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="text-sm">
                  Status: <span className={runnerResult.ok ? 'text-green-600' : 'text-red-600'}>{runnerResult.status}</span>
                  {' '}| Duration: {runnerResult.durationMs}ms
                </p>

                <p className="text-xs text-muted-foreground font-mono break-all">{runnerResult.url}</p>

                <details className="text-xs">
                  <summary className="cursor-pointer">Response headers</summary>

                  <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80 p-3">
                    {JSON.stringify(runnerResult.headers, null, 2)}
                  </pre>
                </details>

                <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-100">
                  {runnerDataPreview}
                </pre>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick endpoint from the table using "Use in runner".
          </p>
        )}
      </section>

      {loading && <p className="text-sm text-muted-foreground">Loading interactive API...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && endpoints.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No API endpoints detected with current filters.
        </p>
      )}

      {!loading && !error && endpoints.length > 0 && (
        <div className="glass-panel overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-full">
            <thead className="bg-white/4">
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Method</th>

                <th className="px-3 py-2">Path</th>

                <th className="px-3 py-2">Framework</th>

                <th className="px-3 py-2">Module</th>

                <th className="px-3 py-2">File</th>

                <th className="px-3 py-2">Params</th>

                <th className="px-3 py-2">Code</th>

                <th className="px-3 py-2">Runner</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map(endpoint => (
                <EndpointRow
                  endpoint={endpoint}
                  isActive={selectedEndpoint?.id === endpoint.id}
                  key={endpoint.id}
                  onUse={initializeRunnerForEndpoint}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
