'use client'

import type { RepoGraphEdgeType } from '@workspace/codepath-common/graph'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import InteractiveRepoGraph from '@/components/InteractiveRepoGraph'
import { getFirstRouteParam } from '@/lib/route-params'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { getGraphs, getInteractiveGraph } from '@/redux/slices/graphsSlice'

const EDGE_TYPE_OPTIONS: RepoGraphEdgeType[] = [
  'imports',
  'calls',
  'depends_on',
  'owns',
  'produces',
  'consumes'
]

const normalizeFilePath = (value: string) => value
  .trim()
  .replaceAll('\\', '/')
  .replace(/^\.\/+/, '')
  .replace(/\/{2,}/g, '/')

export default function Page() {
  const params = useParams()
  const dispatch = useAppDispatch()
  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const interactiveGraph = useAppSelector(state => state.graphs.interactiveGraph)
  const loadingInteractive = useAppSelector(state => state.graphs.loadingInteractive)
  const legacyGraphs = useAppSelector(state => state.graphs.graphs)

  const [depth, setDepth] = useState(2)
  const [focusedNodeId, setFocusedNodeId] = useState<null | string>(null)
  const [scopeToFocus, setScopeToFocus] = useState(false)
  const [includeSymbols, setIncludeSymbols] = useState(false)
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<RepoGraphEdgeType[]>(EDGE_TYPE_OPTIONS)
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<string[]>([])

  useEffect(() => {
    if (!Number.isFinite(repoId)) {
      return
    }

    void dispatch(getInteractiveGraph({ includeSymbols, repoId }))
    void dispatch(getGraphs(repoId))
  }, [dispatch, includeSymbols, repoId])

  useEffect(() => {
    if (!interactiveGraph) {
      return
    }

    if (!focusedNodeId) {
      return
    }

    const exists = interactiveGraph.nodes.some(node => node.id === focusedNodeId)
    if (!exists) {
      setFocusedNodeId(null)
    }
  }, [focusedNodeId, interactiveGraph])

  const moduleNodes = useMemo(() => {
    if (!interactiveGraph) {
      return []
    }

    return interactiveGraph.nodes.filter(node => node.type === 'module')
  }, [interactiveGraph])

  const applyFilters = () => {
    if (!Number.isFinite(repoId)) {
      return
    }

    const useAllRelationTypes = selectedRelationTypes.length === EDGE_TYPE_OPTIONS.length

    void dispatch(getInteractiveGraph({
      depth: scopeToFocus ? depth : undefined,
      focusNodeId: scopeToFocus ? (focusedNodeId ?? undefined) : undefined,
      includeSymbols,
      relationTypes: useAllRelationTypes ? undefined : selectedRelationTypes,
      repoId
    }))
  }

  const resetFilters = () => {
    setDepth(2)
    setScopeToFocus(false)
    setCollapsedModuleIds([])
    setFocusedNodeId(null)
    setSelectedRelationTypes(EDGE_TYPE_OPTIONS)
    if (Number.isFinite(repoId)) {
      void dispatch(getInteractiveGraph({ includeSymbols, repoId }))
    }
  }

  const toggleRelationType = (relationType: RepoGraphEdgeType) => {
    setSelectedRelationTypes(prev => (
      prev.includes(relationType)
        ? prev.filter(type => type !== relationType)
        : [...prev, relationType]
    ))
  }

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModuleIds(prev => (
      prev.includes(moduleId)
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    ))
  }

  const availableRelationTypes = interactiveGraph?.metadata.availableEdgeTypes ?? EDGE_TYPE_OPTIONS

  const nodeById = useMemo(() => {
    if (!interactiveGraph) {
      return new Map()
    }

    return new Map(interactiveGraph.nodes.map(node => [node.id, node]))
  }, [interactiveGraph])

  const focusedNode = useMemo(() => {
    if (!interactiveGraph || !focusedNodeId) {
      return null
    }

    return interactiveGraph.nodes.find(node => node.id === focusedNodeId) ?? null
  }, [focusedNodeId, interactiveGraph])

  const focusedFilePath = useMemo(() => {
    if (!focusedNode) {
      return null
    }

    if (focusedNode.type === 'file') {
      return normalizeFilePath(focusedNode.metadata?.filePath ?? focusedNode.label)
    }

    if (focusedNode.type === 'symbol' && focusedNode.metadata?.filePath) {
      return normalizeFilePath(focusedNode.metadata.filePath)
    }

    return null
  }, [focusedNode])

  const focusedPath = useMemo(() => {
    if (!interactiveGraph || !focusedNode) {
      return [] as string[]
    }

    const path: string[] = [interactiveGraph.metadata.repoName]
    const moduleNode = focusedNode.metadata?.moduleId ? nodeById.get(focusedNode.metadata.moduleId) : null

    if (moduleNode?.label) {
      path.push(moduleNode.label)
    }

    if (focusedNode.type === 'file') {
      path.push(focusedNode.label)
    } else if (focusedNode.type === 'symbol') {
      if (focusedFilePath) {
        path.push(focusedFilePath)
      }
      path.push(focusedNode.label)
    } else if (focusedNode.type === 'external_package') {
      path.push(focusedNode.label)
    } else if (focusedNode.type === 'module') {
      path.push(focusedNode.label)
    }

    return path
  }, [focusedFilePath, focusedNode, interactiveGraph, nodeById])

  const legacyGraphByPath = useMemo(() => {
    const byPath = new Map<string, { id: number }>()
    for (const graph of legacyGraphs) {
      byPath.set(normalizeFilePath(graph.fileName), { id: graph.id })
    }
    return byPath
  }, [legacyGraphs])

  const focusedLegacyGraphId = useMemo(() => {
    if (!focusedFilePath) {
      return null
    }

    return legacyGraphByPath.get(focusedFilePath)?.id ?? null
  }, [focusedFilePath, legacyGraphByPath])

  const scopeToFocusedNodeNow = () => {
    if (!Number.isFinite(repoId) || !focusedNodeId) {
      return
    }

    setScopeToFocus(true)
    void dispatch(getInteractiveGraph({
      depth,
      focusNodeId: focusedNodeId,
      includeSymbols,
      relationTypes: selectedRelationTypes.length === EDGE_TYPE_OPTIONS.length ? undefined : selectedRelationTypes,
      repoId
    }))
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Repository Graph</h1>
        <p className="text-sm text-muted-foreground">
          Repo-level graph with node focus, scoped traversal and relation filtering.
        </p>
      </div>

      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              checked={scopeToFocus}
              onChange={event => setScopeToFocus(event.target.checked)}
              type="checkbox"
            />
            <span>Scope to focused node</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              checked={includeSymbols}
              onChange={event => setIncludeSymbols(event.target.checked)}
              type="checkbox"
            />
            <span>Include symbols (detailed mode)</span>
          </label>

          <label className="flex items-center gap-2">
            <span>Depth</span>
            <input
              className="w-16 rounded-md border border-border bg-background px-2 py-1"
              max={5}
              min={1}
              onChange={event => setDepth(Number(event.target.value))}
              type="number"
              value={depth}
            />
          </label>

          <button
            className="rounded-md border border-border px-3 py-1.5"
            onClick={applyFilters}
            type="button"
          >
            Apply filters
          </button>

          <button
            className="rounded-md border border-border px-3 py-1.5"
            onClick={resetFilters}
            type="button"
          >
            Reset
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">Relation filters</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {EDGE_TYPE_OPTIONS.map(relationType => {
              const isAvailable = availableRelationTypes.includes(relationType)
              return (
                <label className={`flex items-center gap-2 ${isAvailable ? '' : 'opacity-40'}`} key={relationType}>
                  <input
                    checked={selectedRelationTypes.includes(relationType)}
                    onChange={() => toggleRelationType(relationType)}
                    type="checkbox"
                  />
                  <span>{relationType}</span>
                </label>
              )
            })}
          </div>
        </div>

        {moduleNodes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Expand / collapse modules</p>
            <div className="flex flex-wrap gap-2">
              {moduleNodes.map(moduleNode => {
                const collapsed = collapsedModuleIds.includes(moduleNode.id)
                return (
                  <button
                    className={`rounded-md border px-2 py-1 text-xs ${collapsed ? 'border-yellow-500 text-yellow-500' : 'border-border'}`}
                    key={moduleNode.id}
                    onClick={() => toggleModuleCollapse(moduleNode.id)}
                    type="button"
                  >
                    {collapsed ? 'Expand' : 'Collapse'} {moduleNode.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {focusedNodeId && (
          <p className="text-xs text-muted-foreground">
            Focused node: <span className="font-medium text-foreground">{focusedNodeId}</span>
          </p>
        )}
      </div>

      {loadingInteractive && (
        <p className="text-sm text-muted-foreground">Loading interactive graph...</p>
      )}

      {!loadingInteractive && !interactiveGraph && (
        <p className="text-sm text-muted-foreground">
          No graph data available for this repository yet.
        </p>
      )}

      {interactiveGraph && (
        <InteractiveRepoGraph
          collapsedModuleIds={collapsedModuleIds}
          focusedNodeId={focusedNodeId}
          graph={interactiveGraph}
          onFocusNode={setFocusedNodeId}
        />
      )}

      {interactiveGraph?.metadata.truncated && (
        <div className="rounded-md border border-yellow-500/60 bg-yellow-50/30 p-3 text-xs text-yellow-800 dark:text-yellow-300">
          Graph view is truncated for responsiveness ({interactiveGraph.metadata.truncationReason ?? 'limits applied'}).
          Use filters/focus or disable symbols to inspect a smaller subgraph.
        </div>
      )}

      {interactiveGraph && (
        <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {interactiveGraph.metadata.topologyMode && (
              <span>Topology mode: {interactiveGraph.metadata.topologyMode}</span>
            )}
            {interactiveGraph.metadata.importResolution && (
              <span>
                Import resolution: {interactiveGraph.metadata.importResolution.resolved ?? 0}/
                {interactiveGraph.metadata.importResolution.total ?? 0}
                {typeof interactiveGraph.metadata.importResolution.ratio === 'number'
                  ? ` (${Math.round(interactiveGraph.metadata.importResolution.ratio * 100)}%)`
                  : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {focusedNode && (
        <div className="rounded-md border border-border bg-card p-4 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Focused Node</p>
            <p className="text-sm">
              <span className="font-semibold">{focusedNode.label}</span>{' '}
              <span className="text-muted-foreground">({focusedNode.type})</span>
            </p>
          </div>

          {focusedPath.length > 0 && (
            <p className="text-xs text-muted-foreground break-all">
              Focus path: {focusedPath.join(' -> ')}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <button
              className="rounded-md border border-border px-3 py-1.5"
              onClick={scopeToFocusedNodeNow}
              type="button"
            >
              Scope to this node now
            </button>

            {focusedLegacyGraphId && (
              <Link
                className="rounded-md border border-border px-3 py-1.5"
                href={`/${repoId}/graphs/${focusedLegacyGraphId}`}
              >
                Open file legacy graph
              </Link>
            )}
          </div>

          {focusedFilePath && !focusedLegacyGraphId && (
            <p className="text-xs text-muted-foreground break-all">
              File path: {focusedFilePath}. Legacy per-file graph is not available for this file.
            </p>
          )}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        {legacyGraphs.length > 0 ? (
          <Link className="underline" href={`/${repoId}/graphs/${legacyGraphs[0].id}`}>
            Open legacy per-file Mermaid graph
          </Link>
        ) : (
          <span>Legacy per-file graphs are not available for this repository.</span>
        )}
      </div>
    </div>
  )
}
