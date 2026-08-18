'use client'

import type { Nullable } from '@workspace/codepath-common'
import type {
  RepoApiEndpoint,
  RepoApiFramework,
  RepoApiHttpMethod,
  RepoApiRunnerAuthPreset,
  RepoApiRunnerCollection,
  RepoApiRunnerCollectionConfig,
  RepoApiRunnerResponse
} from '@workspace/codepath-common/api-explorer'
import {
  RepoApiFramework as Framework,
  RepoApiHttpMethod as Method
} from '@workspace/codepath-common/api-explorer'
import { useParams } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { createDefaultRunnerAuthConfig } from '@/lib/api-explorer'
import { getFirstRouteParam } from '@/lib/route-params'
import {
  useDeleteRepoRunnerAuthPresetMutation,
  useDeleteRepoRunnerCollectionMutation,
  useGetRepoInteractiveApiQuery,
  useLazyGetRepoInteractiveApiJsonQuery,
  useLazyGetRepoOpenApiSpecQuery,
  useListRepoRunnerAuthPresetsQuery,
  useListRepoRunnerCollectionsQuery,
  useRunRepoApiRequestMutation,
  useSaveRepoRunnerAuthPresetMutation,
  useSaveRepoRunnerCollectionMutation
} from '@/redux/api/apiExplorerApi'

import { ApiExplorerAuthPresetsPanel } from './ApiExplorerAuthPresetsPanel'
import { ApiExplorerCollectionsPanel } from './ApiExplorerCollectionsPanel'
import { ApiExplorerEndpointTable } from './ApiExplorerEndpointTable'
import { ApiExplorerFilters } from './ApiExplorerFilters'
import { ApiExplorerRequestRunner } from './ApiExplorerRequestRunner'
import {
  buildRunnerPayload,
  createRunnerDefaults
} from './apiExplorerRunnerUtils'
import { ApiExplorerStatus } from './ApiExplorerStatus'

const frameworkOptions = [
  Framework.DJANGO,
  Framework.EXPRESS,
  Framework.FASTAPI,
  Framework.FLASK,
  Framework.NESTJS,
  Framework.UNKNOWN
]

const methodOptions = [
  Method.DELETE,
  Method.GET,
  Method.HEAD,
  Method.OPTIONS,
  Method.PATCH,
  Method.POST,
  Method.PUT
]

const errorMessage = (error: unknown) =>
  typeof error === 'object'
  && error !== null
  && 'data' in error
  && typeof (error as { data?: unknown }).data === 'string'
    ? (error as { data: string }).data
    : error instanceof Error
      ? error.message
      : 'Unexpected error'

const downloadJson = (content: unknown, filename: string) => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
  )

  const link = document.createElement('a')

  link.href = url
  link.download = filename

  document.body.appendChild(link)

  link.click()
  link.remove()

  URL.revokeObjectURL(url)
}

export function ApiExplorerClient() {
  const params = useParams()

  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const validRepoId = Number.isFinite(repoId)

  const [search, setSearch] = useState('')
  const [runtimeBaseUrl, setRuntimeBaseUrl] = useState('')
  const [methods, setMethods] = useState<RepoApiHttpMethod[]>([])
  const [frameworks, setFrameworks] = useState<RepoApiFramework[]>([])
  const [selectedEndpoint, setSelectedEndpoint] = useState<Nullable<RepoApiEndpoint>>(null)
  const [baseUrl, setBaseUrl] = useState('http://127.0.0.1:3000')
  const [timeoutMs, setTimeoutMs] = useState(10_000)
  const [pathValues, setPathValues] = useState<Record<string, string>>({})
  const [queryJson, setQueryJson] = useState('{}')
  const [bodyJson, setBodyJson] = useState('{}')
  const [headersJson, setHeadersJson] = useState('{\n  "Accept": "application/json"\n}')
  const [auth, setAuth] = useState<RepoApiRunnerCollectionConfig['auth']>(createDefaultRunnerAuthConfig())
  const [collectionName, setCollectionName] = useState('')
  const [authPresetName, setAuthPresetName] = useState('')
  const [runnerError, setRunnerError] = useState<Nullable<string>>(null)
  const [exportError, setExportError] = useState<Nullable<string>>(null)
  const [result, setResult] = useState<Nullable<RepoApiRunnerResponse>>(null)

  const filters = useMemo(() => ({
    frameworks: frameworks.length ? frameworks : undefined,
    methods: methods.length ? methods : undefined,
    search
  }), [frameworks, methods, search])

  const explorer = useGetRepoInteractiveApiQuery({
    filters, repoId
  }, {
    skip: !validRepoId
  })

  const collections = useListRepoRunnerCollectionsQuery(repoId, {
    skip: !validRepoId
  })

  const presets = useListRepoRunnerAuthPresetsQuery(repoId, {
    skip: !validRepoId
  })

  const [exportEndpoints, endpointsExport] = useLazyGetRepoInteractiveApiJsonQuery()
  const [exportOpenApi, openApiExport] = useLazyGetRepoOpenApiSpecQuery()
  const [runRequest, runState] = useRunRepoApiRequestMutation()
  const [saveCollection] = useSaveRepoRunnerCollectionMutation()
  const [deleteCollection] = useDeleteRepoRunnerCollectionMutation()
  const [savePreset] = useSaveRepoRunnerAuthPresetMutation()
  const [deletePreset] = useDeleteRepoRunnerAuthPresetMutation()

  const endpoints = explorer.data?.endpoints ?? []

  const resetRunner = useCallback((endpoint: RepoApiEndpoint) => {
    const defaults = createRunnerDefaults(endpoint)
    setSelectedEndpoint(endpoint)
    setPathValues(defaults.pathValues)
    setQueryJson(defaults.queryJson)
    setBodyJson(defaults.bodyJson)
    setHeadersJson(defaults.headersJson)
    setCollectionName(`${endpoint.method} ${endpoint.path}`)
    setRunnerError(null)
    setResult(null)
  }, [])

  const run = async () => {
    if (!selectedEndpoint || !validRepoId) {
      return setRunnerError(!selectedEndpoint ? 'Select endpoint first' : 'Invalid repository identifier')
    }

    setRunnerError(null)
    setResult(null)

    try {
      setResult(
        await runRequest({
          repoId,
          payload: buildRunnerPayload(selectedEndpoint, {
            auth,
            baseUrl,
            bodyJson,
            headersJson,
            pathValues,
            queryJson,
            timeoutMs
          })
        }).unwrap()
      )
    } catch (error) {
      setRunnerError(errorMessage(error))
    }
  }
  const saveCurrentCollection = async () => {
    if (!selectedEndpoint || !validRepoId || !collectionName.trim()) {
      return setRunnerError(!selectedEndpoint ? 'Select endpoint first' : !collectionName.trim() ? 'Collection name is required' : 'Invalid repository identifier')
    }

    try {
      await saveCollection({
        repoId,
        payload: {
          name: collectionName.trim(),
          config: {
            auth: { ...auth },
            baseUrl,
            bodyJson,
            endpointId: selectedEndpoint.id,
            endpointMethod: selectedEndpoint.method,
            endpointPath: selectedEndpoint.path,
            headersJson,
            pathValues,
            queryJson,
            timeoutMs
          }
        }
      }).unwrap()
      setRunnerError(null)
    } catch (error) {
      setRunnerError(errorMessage(error))
    }
  }
  const loadCollection = (collection: RepoApiRunnerCollection) => {
    const endpoint = endpoints.find(item => item.id === collection.config.endpointId) ?? endpoints.find(
      item => item.method === collection.config.endpointMethod && item.path === collection.config.endpointPath
    )

    if (!endpoint) return setRunnerError(`Saved endpoint not found in current list: ${collection.config.endpointMethod ?? 'UNKNOWN'} ${collection.config.endpointPath ?? ''}`)

    setSelectedEndpoint(endpoint)
    setBaseUrl(collection.config.baseUrl)
    setTimeoutMs(collection.config.timeoutMs)
    setPathValues(collection.config.pathValues ?? {})
    setQueryJson(collection.config.queryJson)
    setBodyJson(collection.config.bodyJson)
    setHeadersJson(collection.config.headersJson)
    setAuth(collection.config.auth ?? createDefaultRunnerAuthConfig())
    setCollectionName(collection.name)
    setResult(null)
    setRunnerError(null)
  }

  const saveAuthPreset = async () => {
    if (!validRepoId || !authPresetName.trim()) return setRunnerError(!authPresetName.trim() ? 'Auth preset name is required' : 'Invalid repository identifier')

    try {
      await savePreset({ payload: { config: { ...auth }, name: authPresetName.trim() }, repoId }).unwrap()
      setRunnerError(null)
    } catch (error) {
      setRunnerError(errorMessage(error))
    }
  }

  const exportFile = async (openApi: boolean) => {
    if (!validRepoId) return setExportError('Invalid repository identifier')

    setExportError(null)

    try {
      const content = openApi
        ? await exportOpenApi({ filters: { ...filters, runtimeBaseUrl }, repoId }).unwrap()
        : await exportEndpoints({ filters, repoId }).unwrap()

      downloadJson(content, `repo-${repoId}-${openApi ? 'openapi' : 'endpoints'}.json`)
    } catch (error) {
      setExportError(errorMessage(error))
    }
  }
  return (
    <div className="space-y-4.5">
      <PageHeader
        description="Explore detected backend endpoints, generated request payloads, OpenAPI exports and workspace-shared runner presets."
        eyebrow={`Repo ${validRepoId ? repoId : 'unknown'}`}
        title="API Explorer"
      />

      <ApiExplorerFilters
        availableFrameworks={explorer.data?.metadata.frameworks ?? []}
        endpointCount={explorer.data?.metadata.endpointCount ?? 0}
        exportingEndpoints={endpointsExport.isLoading}
        exportingOpenApi={openApiExport.isLoading}
        frameworkOptions={frameworkOptions}
        frameworks={frameworks}
        methodOptions={methodOptions}
        methods={methods}
        onExportEndpoints={() => void exportFile(false)}
        onExportOpenApi={() => void exportFile(true)}
        onRefresh={() => void explorer.refetch()}
        onReset={() => {
          setSearch('')
          setFrameworks([])
          setMethods([])
        }}
        onRuntimeBaseUrlChange={setRuntimeBaseUrl}
        onSearchChange={setSearch}
        onToggleFramework={value => setFrameworks(previous => previous.includes(value)
          ? previous.filter(item => item !== value)
          : [...previous, value]
        )}
        onToggleMethod={value => setMethods(previous => previous.includes(value)
          ? previous.filter(item => item !== value)
          : [...previous, value]
        )}
        runtimeBaseUrl={runtimeBaseUrl}
        search={search}
        segmentCount={explorer.data?.metadata.segmentCount ?? 0}
      />

      <ApiExplorerRequestRunner
        auth={auth}
        baseUrl={baseUrl}
        bodyJson={bodyJson}
        headersJson={headersJson}
        isRunning={runState.isLoading}
        onAuthChange={setAuth}
        onBaseUrlChange={setBaseUrl}
        onBodyJsonChange={setBodyJson}
        onHeadersJsonChange={setHeadersJson}
        onPathValuesChange={setPathValues}
        onQueryJsonChange={setQueryJson}
        onRegenerate={() => selectedEndpoint && resetRunner(selectedEndpoint)}
        onRun={() => void run()}
        onTimeoutChange={setTimeoutMs}
        pathValues={pathValues}
        queryJson={queryJson}
        result={result}
        runnerError={runnerError}
        selectedEndpoint={selectedEndpoint}
        timeoutMs={timeoutMs}
      >
        <ApiExplorerAuthPresetsPanel
          name={authPresetName}
          onDelete={id => void deletePreset({ presetId: id, repoId }).unwrap().catch(error => setRunnerError(errorMessage(error)))}
          onLoad={(preset: RepoApiRunnerAuthPreset) => {
            setAuth({ ...preset.config })
            setAuthPresetName(preset.name)
            setRunnerError(null)
          }}
          onNameChange={setAuthPresetName}
          onSave={() => void saveAuthPreset()}
          presets={presets.data ?? []}
        />

        <ApiExplorerCollectionsPanel
          collections={collections.data ?? []}
          name={collectionName}
          onDelete={id => void deleteCollection({ collectionId: id, repoId }).unwrap().catch(error => setRunnerError(errorMessage(error)))}
          onLoad={loadCollection}
          onNameChange={setCollectionName}
          onSave={() => void saveCurrentCollection()}
        />
      </ApiExplorerRequestRunner>

      <ApiExplorerStatus
        error={exportError ?? (explorer.isError ? errorMessage(explorer.error) : null)}
        hasEndpoints={endpoints.length > 0}
        isError={explorer.isError}
        isLoading={explorer.isLoading}
      />

      {!explorer.isLoading && !explorer.isError && !exportError && endpoints.length > 0 && (
        <ApiExplorerEndpointTable
          endpoints={endpoints}
          onUse={resetRunner}
          selectedEndpointId={selectedEndpoint?.id}
        />
      )}
    </div>
  )
}
