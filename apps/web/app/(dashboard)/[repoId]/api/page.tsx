'use client'

import type {
  RepoApiEndpoint,
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoApiRunnerApiKeyPlacement,
  RepoApiRunnerAuthMode,
  RepoApiRunnerAuthPreset,
  RepoApiRunnerCollection,
  RepoApiRunnerCollectionConfig,
  RepoApiRunnerResponse,
  RepoInteractiveApi
} from '@workspace/codepath-common/api-explorer'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
  'django',
  'express',
  'fastapi',
  'flask',
  'nestjs',
  'unknown'
]

const METHOD_OPTIONS: RepoApiHttpMethod[] = [
  'DELETE',
  'GET',
  'HEAD',
  'OPTIONS',
  'PATCH',
  'POST',
  'PUT'
]

const METHOD_WITH_BODY = new Set<RepoApiHttpMethod>(['PATCH', 'POST', 'PUT'])

const methodClasses: Record<RepoApiHttpMethod, string> = {
  DELETE: 'bg-red-100 text-red-700',
  GET: 'bg-green-100 text-green-700',
  HEAD: 'bg-slate-100 text-slate-700',
  OPTIONS: 'bg-zinc-100 text-zinc-700',
  PATCH: 'bg-orange-100 text-orange-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-purple-100 text-purple-700'
}

const resolveErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const responseData = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message

    if (Array.isArray(responseData)) {
      return responseData.join(', ')
    }

    if (typeof responseData === 'string') {
      return responseData
    }
  }

  if (error instanceof Error) {
    return error.message
  }

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
    if (match[1]) {
      names.push(match[1])
    }
  }

  for (const match of path.matchAll(/\{([A-Za-z0-9_]+)(?::[^}]+)?}/g)) {
    if (match[1]) {
      names.push(match[1])
    }
  }

  for (const match of path.matchAll(/<(?:(?:[A-Za-z0-9_]+):)?([A-Za-z0-9_]+)>/g)) {
    if (match[1]) {
      names.push(match[1])
    }
  }

  return Array.from(new Set(names))
}

const generateSampleValue = (name: string, seed: string) => {
  const lowered = name.trim().toLowerCase()
  const deterministic = hashString(`${seed}:${lowered}`)

  if (lowered.includes('uuid')) {
    return '550e8400-e29b-41d4-a716-446655440000'
  }
  if (lowered.includes('email')) {
    return `user${deterministic % 100}@example.com`
  }
  if (lowered.includes('phone')) {
    return `+4812345${String(deterministic % 10_000).padStart(4, '0')}`
  }
  if (lowered.includes('date')) {
    return '2026-01-01'
  }
  if (lowered.includes('time')) {
    return '2026-01-01T10:00:00.000Z'
  }
  if (lowered.includes('token')) {
    return `token-${deterministic.toString(16)}`
  }
  if (lowered.includes('price') || lowered.includes('amount') || lowered.includes('total')) {
    return Number(((deterministic % 20000) / 100).toFixed(2))
  }
  if (lowered.includes('count') || lowered.includes('limit') || lowered.includes('page') || lowered.includes('offset')) {
    return (deterministic % 50) + 1
  }
  if (lowered.includes('active') || lowered.includes('enabled') || lowered.startsWith('is')) {
    return deterministic % 2 === 0
  }
  if (lowered === 'id' || lowered.endsWith('_id') || lowered.endsWith('id')) {
    return (deterministic % 9000) + 1000
  }
  if (lowered.includes('name')) {
    return `sample-${lowered}-${deterministic % 100}`
  }

  return `sample-${lowered || 'value'}-${deterministic % 1000}`
}

const parseJsonObjectInput = (raw: string, label: string) => {
  try {
    const parsed = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`)
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${label}: ${error.message}`)
    }

    throw new Error(`${label}: invalid JSON`)
  }
}

const parseJsonInput = (raw: string, label: string) => {
  try {
    return JSON.parse(raw)
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${label}: ${error.message}`)
    }

    throw new Error(`${label}: invalid JSON`)
  }
}

const normalizeBaseUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error('Base URL is required')
  }

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
      .replace(new RegExp(`<(?:(?:[A-Za-z0-9_]+):)?${name}>`, 'g'), encoded)
  }

  return resolved
}

const buildRunnerUrl = (baseUrl: string, path: string, query: Record<string, unknown>) => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const finalUrl = new URL(path.startsWith('/') ? path : `/${path}`, normalizedBaseUrl)

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue
    }

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

  if (auth.mode === 'bearer') {
    if (!auth.bearerToken.trim()) {
      throw new Error('Bearer token is required')
    }
    headers.Authorization = `Bearer ${auth.bearerToken.trim()}`
  }

  if (auth.mode === 'basic') {
    const username = auth.basicUsername.trim()
    const password = auth.basicPassword
    if (!username) {
      throw new Error('Basic username is required')
    }

    const encoded = window.btoa(`${username}:${password}`)

    headers.Authorization = `Basic ${encoded}`
  }

  if (auth.mode === 'apiKey') {
    const keyName = auth.apiKeyName.trim()
    const keyValue = auth.apiKeyValue.trim()
    if (!keyName) {
      throw new Error('API key name is required')
    }
    if (!keyValue) {
      throw new Error('API key value is required')
    }

    if (auth.apiKeyPlacement === 'query') {
      query[keyName] = keyValue
    } else {
      headers[keyName] = keyValue
    }
  }

  return {
    headers,
    query
  }
}

function EndpointRow({
  endpoint,
  isActive,
  onUse
}: {
  endpoint: RepoApiEndpoint
  isActive: boolean
  onUse: (endpoint: RepoApiEndpoint) => void
}) {
  return (
    <tr className="border-b border-border">
      <td className="px-3 py-2 align-top">
        <span className={`rounded px-2 py-1 text-xs font-semibold ${methodClasses[endpoint.method]}`}>
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
                className="rounded border border-border bg-muted px-1.5 py-0.5"
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
            <pre className="mt-2 max-h-44 overflow-auto rounded bg-muted p-2 font-mono text-[11px] leading-relaxed">
              {endpoint.sourceSnippet}
            </pre>
          </details>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </td>
      <td className="px-3 py-2 align-top">
        <button
          className={`rounded-md border px-2 py-1 text-xs ${isActive ? 'border-primary text-primary' : 'border-border'}`}
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

  const [data, setData] = useState<null | RepoInteractiveApi>(null)
  const [loading, setLoading] = useState(false)
  const [exportingEndpoints, setExportingEndpoints] = useState(false)
  const [exportingOpenApi, setExportingOpenApi] = useState(false)
  const [error, setError] = useState<null | string>(null)
  const [search, setSearch] = useState('')
  const [runtimeOpenApiBaseUrl, setRuntimeOpenApiBaseUrl] = useState('')
  const [selectedMethods, setSelectedMethods] = useState<RepoApiHttpMethod[]>([])
  const [selectedFrameworks, setSelectedFrameworks] = useState<RepoApiFramework[]>([])

  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:3000')
  const [timeoutMs, setTimeoutMs] = useState(10_000)
  const [selectedEndpoint, setSelectedEndpoint] = useState<null | RepoApiEndpoint>(null)
  const [pathValues, setPathValues] = useState<Record<string, string>>({})
  const [queryJson, setQueryJson] = useState('{}')
  const [bodyJson, setBodyJson] = useState('{}')
  const [headersJson, setHeadersJson] = useState('{\n  "Accept": "application/json"\n}')
  const [runningRequest, setRunningRequest] = useState(false)
  const [runnerError, setRunnerError] = useState<null | string>(null)
  const [runnerResult, setRunnerResult] = useState<null | RepoApiRunnerResponse>(null)
  const [auth, setAuth] = useState<RepoApiRunnerCollectionConfig['auth']>(createDefaultRunnerAuthConfig())
  const [runnerAuthPresets, setRunnerAuthPresets] = useState<RepoApiRunnerAuthPreset[]>([])
  const [authPresetNameInput, setAuthPresetNameInput] = useState('')
  const [runnerCollections, setRunnerCollections] = useState<RepoApiRunnerCollection[]>([])
  const [collectionNameInput, setCollectionNameInput] = useState('')

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
    if (!Number.isFinite(repoId)) {
      return
    }

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
    if (!Number.isFinite(repoId)) {
      return
    }

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
      ...endpoint.params.filter(param => param.location === 'path').map(param => param.name)
    ])

    const nextPathValues: Record<string, string> = {}
    for (const name of pathParamNames) {
      nextPathValues[name] = String(generateSampleValue(name, seed))
    }

    const nextQuery: Record<string, unknown> = {}
    for (const param of endpoint.params.filter(param => param.location === 'query')) {
      nextQuery[param.name] = generateSampleValue(param.name, seed)
    }

    const nextBody: Record<string, unknown> = {}
    for (const param of endpoint.params.filter(param => param.location === 'body')) {
      const key = param.name === 'body' ? 'payload' : param.name
      nextBody[key] = generateSampleValue(key, seed)
    }

    if (METHOD_WITH_BODY.has(endpoint.method) && Object.keys(nextBody).length === 0) {
      nextBody.payload = `sample-${hashString(seed) % 1000}`
    }

    const nextHeaders: Record<string, string> = {
      Accept: 'application/json'
    }

    if (METHOD_WITH_BODY.has(endpoint.method)) {
      nextHeaders['Content-Type'] = 'application/json'
    }

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
    setSelectedMethods(prev => (
      prev.includes(method)
        ? prev.filter(value => value !== method)
        : [...prev, method]
    ))
  }

  const toggleFramework = (framework: RepoApiFramework) => {
    setSelectedFrameworks(prev => (
      prev.includes(framework)
        ? prev.filter(value => value !== framework)
        : [...prev, framework]
    ))
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
        },
        name
      })

      setRunnerCollections(prev => [
        saved,
        ...prev.filter(collection => collection.id !== saved.id)
      ])
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
      setRunnerError(
        `Saved endpoint not found in current list: ${collection.config.endpointMethod ?? 'UNKNOWN'} ${collection.config.endpointPath ?? ''}`
      )
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
    if (!Number.isFinite(repoId)) {
      return
    }

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

      setRunnerAuthPresets(prev => [
        saved,
        ...prev.filter(preset => preset.id !== saved.id)
      ])
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
    if (!Number.isFinite(repoId)) {
      return
    }

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
        if (!normalizedKey) {
          continue
        }
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
    if (!runnerResult) {
      return ''
    }

    if (typeof runnerResult.data === 'string') {
      return runnerResult.data
    }

    return JSON.stringify(runnerResult.data, null, 2)
  }, [runnerResult])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">API Explorer</h1>
        <p className="text-muted-foreground">
          Repo: {Number.isFinite(repoId) ? repoId : String(getFirstRouteParam(params.repoId))}
        </p>
        <p className="text-sm text-muted-foreground">
          Endpoints: {data?.metadata.endpointCount ?? 0} | Segments scanned: {data?.metadata.segmentCount ?? 0}
        </p>
      </div>

      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="api-search">Search</label>
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            id="api-search"
            onChange={event => setSearch(event.target.value)}
            placeholder="path, file, method, framework..."
            value={search}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="runtime-openapi-base-url">
            Runtime OpenAPI Base URL (optional)
          </label>
          <input
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            id="runtime-openapi-base-url"
            onChange={event => setRuntimeOpenApiBaseUrl(event.target.value)}
            placeholder="http://127.0.0.1:3001"
            value={runtimeOpenApiBaseUrl}
          />
          <p className="text-xs text-muted-foreground">
            OpenAPI export: runtime-first from this URL, with static fallback from code.
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Methods</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {METHOD_OPTIONS.map(method => (
              <label className="flex items-center gap-2" key={method}>
                <input
                  checked={selectedMethods.includes(method)}
                  onChange={() => toggleMethod(method)}
                  type="checkbox"
                />
                <span>{method}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Frameworks</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {FRAMEWORK_OPTIONS.map(framework => {
              const enabled = availableFrameworks.length === 0 || availableFrameworks.includes(framework)
              return (
                <label className={`flex items-center gap-2 ${enabled ? '' : 'opacity-40'}`} key={framework}>
                  <input
                    checked={selectedFrameworks.includes(framework)}
                    onChange={() => toggleFramework(framework)}
                    type="checkbox"
                  />
                  <span>{framework}</span>
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-md border border-border px-3 py-2 text-sm"
            onClick={loadExplorer}
            type="button"
          >
            Apply filters
          </button>
          <button
            className="rounded-md border border-border px-3 py-2 text-sm"
            onClick={resetFilters}
            type="button"
          >
            Reset
          </button>
          <button
            className="rounded-md border border-border px-3 py-2 text-sm"
            onClick={loadExplorer}
            type="button"
          >
            Refresh
          </button>
          <button
            className="rounded-md border border-border px-3 py-2 text-sm"
            disabled={exportingEndpoints}
            onClick={handleExportEndpointsJson}
            type="button"
          >
            {exportingEndpoints ? 'Exporting...' : 'Export Endpoints JSON'}
          </button>
          <button
            className="rounded-md border border-border px-3 py-2 text-sm"
            disabled={exportingOpenApi}
            onClick={handleExportOpenApi}
            type="button"
          >
            {exportingOpenApi ? 'Exporting...' : 'Export OpenAPI JSON'}
          </button>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">API Runner (MVP)</h2>
          {selectedEndpoint && (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedEndpoint.method} {selectedEndpoint.path}
            </p>
          )}
        </div>

        {selectedEndpoint?.sourceSnippet && (
          <details className="rounded-md border border-border p-2 text-xs">
            <summary className="cursor-pointer text-primary">
              Source fragment{selectedEndpoint.sourceLineStart ? ` (L${selectedEndpoint.sourceLineStart})` : ''}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-[11px] leading-relaxed">
              {selectedEndpoint.sourceSnippet}
            </pre>
          </details>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span>Base URL</span>
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              onChange={event => setBaseUrl(event.target.value)}
              placeholder="http://127.0.0.1:3000"
              value={baseUrl}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Timeout (ms)</span>
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              min={1000}
              onChange={event => setTimeoutMs(Number(event.target.value))}
              type="number"
              value={timeoutMs}
            />
          </label>
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Auth preset</p>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Mode</span>
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                onChange={event => setAuth(prev => ({ ...prev, mode: event.target.value as RepoApiRunnerAuthMode }))}
                value={auth.mode}
              >
                <option value="none">None</option>
                <option value="bearer">Bearer token</option>
                <option value="basic">Basic auth</option>
                <option value="apiKey">API key</option>
              </select>
            </label>
          </div>

          {auth.mode === 'bearer' && (
            <label className="flex flex-col gap-1 text-sm">
              <span>Bearer token</span>
              <input
                className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                onChange={event => setAuth(prev => ({ ...prev, bearerToken: event.target.value }))}
                placeholder="eyJhbGciOi..."
                value={auth.bearerToken}
              />
            </label>
          )}

          {auth.mode === 'basic' && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span>Username</span>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  onChange={event => setAuth(prev => ({ ...prev, basicUsername: event.target.value }))}
                  value={auth.basicUsername}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Password</span>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  onChange={event => setAuth(prev => ({ ...prev, basicPassword: event.target.value }))}
                  type="password"
                  value={auth.basicPassword}
                />
              </label>
            </div>
          )}

          {auth.mode === 'apiKey' && (
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>Key name</span>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  onChange={event => setAuth(prev => ({ ...prev, apiKeyName: event.target.value }))}
                  value={auth.apiKeyName}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Key value</span>
                <input
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  onChange={event => setAuth(prev => ({ ...prev, apiKeyValue: event.target.value }))}
                  type="password"
                  value={auth.apiKeyValue}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Placement</span>
                <select
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  onChange={event => setAuth(prev => ({ ...prev, apiKeyPlacement: event.target.value as RepoApiRunnerApiKeyPlacement }))}
                  value={auth.apiKeyPlacement}
                >
                  <option value="header">Header</option>
                  <option value="query">Query</option>
                </select>
              </label>
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Auth presets (workspace-shared)</p>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              onChange={event => setAuthPresetNameInput(event.target.value)}
              placeholder="Auth preset name"
              value={authPresetNameInput}
            />
            <button
              className="rounded-md border border-border px-3 py-2 text-sm"
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
                <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1" key={preset.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{preset.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      mode: {preset.config.mode}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => handleLoadAuthPreset(preset)}
                      type="button"
                    >
                      Load
                    </button>
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs"
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

        <div className="space-y-2 rounded-md border border-border p-3">
          <p className="text-xs font-medium uppercase text-muted-foreground">Request collections (workspace-shared)</p>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              onChange={event => setCollectionNameInput(event.target.value)}
              placeholder="Collection name"
              value={collectionNameInput}
            />
            <button
              className="rounded-md border border-border px-3 py-2 text-sm"
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
                <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1" key={collection.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{collection.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {collection.config.endpointMethod ?? 'UNKNOWN'} {collection.config.endpointPath ?? ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs"
                      onClick={() => handleLoadCollection(collection)}
                      type="button"
                    >
                      Load
                    </button>
                    <button
                      className="rounded-md border border-border px-2 py-1 text-xs"
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
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
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
                <textarea
                  className="h-36 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                  onChange={event => setQueryJson(event.target.value)}
                  value={queryJson}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Body JSON</span>
                <textarea
                  className="h-36 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                  onChange={event => setBodyJson(event.target.value)}
                  value={bodyJson}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Headers JSON</span>
                <textarea
                  className="h-36 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
                  onChange={event => setHeadersJson(event.target.value)}
                  value={headersJson}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-md border border-border px-3 py-2 text-sm"
                onClick={() => initializeRunnerForEndpoint(selectedEndpoint)}
                type="button"
              >
                Regenerate test payload
              </button>
              <button
                className="rounded-md border border-border px-3 py-2 text-sm"
                disabled={runningRequest}
                onClick={handleRunRequest}
                type="button"
              >
                {runningRequest ? 'Sending...' : 'Send request'}
              </button>
            </div>

            {runnerError && (
              <p className="text-sm text-red-500">{runnerError}</p>
            )}

            {runnerResult && (
              <div className="space-y-2 rounded-md border border-border bg-background p-3">
                <p className="text-sm">
                  Status: <span className={runnerResult.ok ? 'text-green-600' : 'text-red-600'}>{runnerResult.status}</span>
                  {' '}| Duration: {runnerResult.durationMs}ms
                </p>
                <p className="text-xs text-muted-foreground font-mono break-all">{runnerResult.url}</p>
                <details className="text-xs">
                  <summary className="cursor-pointer">Response headers</summary>
                  <pre className="mt-2 overflow-x-auto rounded bg-muted p-2">
                    {JSON.stringify(runnerResult.headers, null, 2)}
                  </pre>
                </details>
                <pre className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">
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
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading interactive API...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && endpoints.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No API endpoints detected with current filters.
        </p>
      )}

      {!loading && !error && endpoints.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="min-w-full">
            <thead className="bg-muted/60">
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
