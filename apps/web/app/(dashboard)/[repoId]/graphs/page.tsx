'use client'

import type { RepoGraphEdgeType } from '@workspace/codepath-common/graph'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Focus, GitBranch, GitFork, Layers3, RotateCcw, SlidersHorizontal, Target } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import InteractiveRepoGraph from '@/components/InteractiveRepoGraph'
import { PageHeader } from '@/components/PageHeader'
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
  const legacyGraphs = useAppSelector(state => state.graphs.graphs)
  const loadingInteractive = useAppSelector(state => state.graphs.loadingInteractive)

  const [collapsedModuleIds, setCollapsedModuleIds] = useState<string[]>([])
  const [depth, setDepth] = useState(2)
  const [focusedNodeId, setFocusedNodeId] = useState<null | string>(null)
  const [includeSymbols, setIncludeSymbols] = useState(false)
  const [scopeToFocus, setScopeToFocus] = useState(false)
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<RepoGraphEdgeType[]>(EDGE_TYPE_OPTIONS)

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
      return new Map<string, NonNullable<typeof interactiveGraph>['nodes'][number]>()
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
    <div className="space-y-6">
      <PageHeader
        actions={(
          <>
            <Button onClick={applyFilters} type="button" variant="glow">
              <SlidersHorizontal className="size-4" />
              Apply filters
            </Button>
            <Button onClick={resetFilters} type="button" variant="glass">
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </>
        )}
        description="Visualize first-party repository logic, relationships and focused traversal without external dependency noise."
        eyebrow={`Repo ${Number.isFinite(repoId) ? repoId : 'unknown'}`}
        title="Repository Graph"
      />

      <section aria-label="Graph filters" className="glass-panel rounded-3xl p-4 md:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-muted-foreground transition hover:border-primary/40 hover:text-white">
                <input
                  checked={scopeToFocus}
                  className="size-4 accent-primary"
                  onChange={event => setScopeToFocus(event.target.checked)}
                  type="checkbox"
                />
                <Target className="size-4 text-primary" />
                Scope to focused node
              </label>

              <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-muted-foreground transition hover:border-primary/40 hover:text-white">
                <input
                  checked={includeSymbols}
                  className="size-4 accent-primary"
                  onChange={event => setIncludeSymbols(event.target.checked)}
                  type="checkbox"
                />
                <Layers3 className="size-4 text-cyan-300" />
                Include symbols
              </label>

              <label className="flex min-h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm text-muted-foreground">
                Depth
                <Input
                  aria-label="Graph traversal depth"
                  className="h-8 w-20 bg-slate-950/50 px-2"
                  max={5}
                  min={1}
                  onChange={event => setDepth(Number(event.target.value))}
                  type="number"
                  value={depth}
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Relation filters</p>
              <div className="flex flex-wrap gap-2 text-sm">
                {EDGE_TYPE_OPTIONS.map(relationType => {
                  const isAvailable = availableRelationTypes.includes(relationType)
                  const isSelected = selectedRelationTypes.includes(relationType)
                  return (
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 transition ${isSelected ? 'border-primary/50 bg-primary/15 text-white' : 'border-white/10 bg-white/[0.03] text-muted-foreground'} ${isAvailable ? '' : 'opacity-40'}`}
                      key={relationType}
                    >
                      <input
                        checked={isSelected}
                        className="size-3.5 accent-primary"
                        onChange={() => toggleRelationType(relationType)}
                        type="checkbox"
                      />
                      {relationType}
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <GitBranch className="size-4 text-cyan-300" />
              Graph summary
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Nodes</dt>
                <dd className="mt-1 text-2xl font-bold tracking-[-0.05em] text-white">{interactiveGraph?.nodes.length ?? 0}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Edges</dt>
                <dd className="mt-1 text-2xl font-bold tracking-[-0.05em] text-white">{interactiveGraph?.edges.length ?? 0}</dd>
              </div>
            </dl>
            {focusedNodeId && (
              <p className="mt-4 break-all rounded-xl border border-primary/25 bg-primary/10 p-3 text-xs text-muted-foreground">
                Focused: <span className="font-medium text-white">{focusedNodeId}</span>
              </p>
            )}
          </div>
        </div>

        {moduleNodes.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Expand / collapse modules</p>
            <div className="flex flex-wrap gap-2">
              {moduleNodes.map(moduleNode => {
                const collapsed = collapsedModuleIds.includes(moduleNode.id)
                return (
                  <button
                    className={`rounded-full border px-3 py-1.5 text-xs transition ${collapsed ? 'border-amber-300/50 bg-amber-300/10 text-amber-200' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-primary/40 hover:text-white'}`}
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
      </section>

      {loadingInteractive && (
        <div className="glass-panel rounded-3xl p-6 text-sm text-muted-foreground" role="status">
          Loading interactive graph...
        </div>
      )}

      {!loadingInteractive && !interactiveGraph && (
        <div className="glass-panel rounded-3xl p-8 text-center text-sm text-muted-foreground">
          No graph data available for this repository yet.
        </div>
      )}

      {interactiveGraph && (
        <section aria-label="Interactive repository graph" className="glass-panel-strong rounded-[2rem] p-4">
          <InteractiveRepoGraph
            collapsedModuleIds={collapsedModuleIds}
            focusedNodeId={focusedNodeId}
            graph={interactiveGraph}
            onFocusNode={setFocusedNodeId}
          />
        </section>
      )}

      {interactiveGraph?.metadata.truncated && (
        <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-4 text-xs text-amber-100">
          Graph view is truncated for responsiveness ({interactiveGraph.metadata.truncationReason ?? 'limits applied'}).
          Use filters/focus or disable symbols to inspect a smaller subgraph.
        </div>
      )}

      {interactiveGraph && (
        <div className="glass-panel rounded-2xl p-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
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
        <section aria-label="Focused node details" className="glass-panel rounded-3xl p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Focused node</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">
                {focusedNode.label}{' '}
                <span className="text-sm font-normal text-muted-foreground">({focusedNode.type})</span>
              </h2>
              {focusedPath.length > 0 && (
                <p className="mt-3 break-all text-xs text-muted-foreground">
                  Focus path: {focusedPath.join(' -> ')}
                </p>
              )}
              {focusedFilePath && !focusedLegacyGraphId && (
                <p className="mt-3 break-all text-xs text-muted-foreground">
                  File path: {focusedFilePath}. Legacy per-file graph is not available for this file.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Button onClick={scopeToFocusedNodeNow} type="button" variant="glass">
                <Focus className="size-4" />
                Scope now
              </Button>

              {focusedLegacyGraphId && (
                <Button asChild variant="glass">
                  <Link href={`/${repoId}/graphs/${focusedLegacyGraphId}`}>
                    <GitFork className="size-4" />
                    Open legacy graph
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="text-sm text-muted-foreground">
        {legacyGraphs.length > 0 ? (
          <Link className="text-primary underline underline-offset-4" href={`/${repoId}/graphs/${legacyGraphs[0].id}`}>
            Open legacy per-file Mermaid graph
          </Link>
        ) : (
          <span>Legacy per-file graphs are not available for this repository.</span>
        )}
      </div>
    </div>
  )
}
