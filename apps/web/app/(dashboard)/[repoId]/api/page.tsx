'use client'

import type { RepoApiEndpoint, RepoApiFramework, RepoApiHttpMethod, RepoInteractiveApi } from '@workspace/codepath-common/api-explorer'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { getRepoInteractiveApi, getRepoInteractiveApiJson, getRepoOpenApiSpec } from '@/lib/api-explorer'
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

const methodClasses: Record<RepoApiHttpMethod, string> = {
  DELETE: 'bg-red-100 text-red-700',
  GET: 'bg-green-100 text-green-700',
  HEAD: 'bg-slate-100 text-slate-700',
  OPTIONS: 'bg-zinc-100 text-zinc-700',
  PATCH: 'bg-orange-100 text-orange-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-purple-100 text-purple-700'
}

function EndpointRow({ endpoint }: { endpoint: RepoApiEndpoint }) {
  return (
    <tr className="border-b border-border">
      <td className="px-3 py-2 align-top">
        <span className={`rounded px-2 py-1 text-xs font-semibold ${methodClasses[endpoint.method]}`}>
          {endpoint.method}
        </span>
      </td>
      <td className="px-3 py-2 align-top font-mono text-xs">{endpoint.path}</td>
      <td className="px-3 py-2 align-top text-sm">{endpoint.framework}</td>
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
  const [selectedMethods, setSelectedMethods] = useState<RepoApiHttpMethod[]>([])
  const [selectedFrameworks, setSelectedFrameworks] = useState<RepoApiFramework[]>([])

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

  const availableFrameworks = data?.metadata.frameworks ?? []
  const endpoints = data?.endpoints ?? []

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
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Params</th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map(endpoint => (
                <EndpointRow endpoint={endpoint} key={endpoint.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
