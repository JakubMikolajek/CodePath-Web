'use client'

import type { Nullable } from '@workspace/codepath-common/globals'
import type { RepoGraphEdgeType } from '@workspace/codepath-common/graph'
import { Button } from '@workspace/ui/components/button'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import { getFirstRouteParam } from '@/lib/route-params'
import {
  useGetRepoGraphsQuery,
  useGetRepoInteractiveGraphQuery
} from '@/redux/api/graphsApi'

import { FocusedNodeDetails } from './FocusedNodeDetails'
import { edgeTypeOptions, GraphControls } from './GraphControls'
import { GraphViewer } from './GraphViewer'

interface InteractiveGraphRequest {
  depth?: number
  focusNodeId?: string
  includeSymbols: boolean
  relationTypes?: RepoGraphEdgeType[]
}

export function GraphExplorerClient() {
  const params = useParams()

  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const validRepoId = Number.isFinite(repoId)

  const [collapsedModuleIds, setCollapsedModuleIds] = useState<string[]>([])
  const [depth, setDepth] = useState(2)
  const [focusedNodeId, setFocusedNodeId] = useState<Nullable<string>>(null)
  const [includeSymbols, setIncludeSymbols] = useState(false)
  const [scopeToFocus, setScopeToFocus] = useState(false)
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<RepoGraphEdgeType[]>(edgeTypeOptions)
  const [request, setRequest] = useState<InteractiveGraphRequest>({ includeSymbols: false })

  const interactiveGraphQuery = useGetRepoInteractiveGraphQuery(
    { repoId, ...request },
    { refetchOnMountOrArgChange: true, skip: !validRepoId }
  )
  const legacyGraphsQuery = useGetRepoGraphsQuery(repoId, {
    refetchOnMountOrArgChange: true,
    skip: !validRepoId
  })

  const interactiveGraph = interactiveGraphQuery.currentData ?? null
  const legacyGraphs = legacyGraphsQuery.currentData ?? []
  const availableRelationTypes = interactiveGraph?.metadata.availableEdgeTypes ?? edgeTypeOptions

  useEffect(() => {
    if (focusedNodeId && interactiveGraph && !interactiveGraph.nodes.some(node => node.id === focusedNodeId)) setFocusedNodeId(null)
  }, [focusedNodeId, interactiveGraph])

  const runQuery = (nextRequest: InteractiveGraphRequest) => {
    setRequest(nextRequest)
  }

  const applyFilters = () => {
    runQuery({
      depth: scopeToFocus ? depth : undefined,
      focusNodeId: scopeToFocus ? (focusedNodeId ?? undefined) : undefined,
      includeSymbols,
      relationTypes: selectedRelationTypes.length === edgeTypeOptions.length ? undefined : selectedRelationTypes
    })
  }

  const resetFilters = () => {
    setDepth(2)
    setScopeToFocus(false)
    setCollapsedModuleIds([])
    setFocusedNodeId(null)
    setSelectedRelationTypes(edgeTypeOptions)
    runQuery({ includeSymbols })
  }

  const setSymbolsAndResetFilters = (nextIncludeSymbols: boolean) => {
    setIncludeSymbols(nextIncludeSymbols)
    runQuery({ includeSymbols: nextIncludeSymbols })
  }

  const toggleRelationType = (relationType: RepoGraphEdgeType) => {
    setSelectedRelationTypes(current => current.includes(relationType)
      ? current.filter(type => type !== relationType)
      : [...current, relationType])
  }

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModuleIds(current => current.includes(moduleId)
      ? current.filter(id => id !== moduleId)
      : [...current, moduleId])
  }

  const scopeToFocusedNodeNow = () => {
    if (!focusedNodeId) return

    setScopeToFocus(true)
    runQuery({
      depth,
      focusNodeId: focusedNodeId,
      includeSymbols,
      relationTypes: selectedRelationTypes.length === edgeTypeOptions.length ? undefined : selectedRelationTypes
    })
  }

  return (
    <div className="space-y-3.5">
      <PageHeader
        actions={(
          <>
            <Button className="rounded-[9px] px-3.5 py-2 text-[12.5px]" onClick={applyFilters} type="button" variant="glow">
              <SlidersHorizontal className="size-4" />
              Apply filters
            </Button>

            <Button className="rounded-[9px] px-3.25 py-2 text-[12.5px]" onClick={resetFilters} type="button" variant="glass">
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </>
        )}
        description="Visualize dependencies and relationships"
        eyebrow={`Repo ${validRepoId ? repoId : 'unknown'}`}
        title="Repository Graph"
      />

      <GraphControls
        availableRelationTypes={availableRelationTypes}
        collapsedModuleIds={collapsedModuleIds}
        depth={depth}
        focusedNodeId={focusedNodeId}
        graph={interactiveGraph}
        includeSymbols={includeSymbols}
        onDepthChange={setDepth}
        onIncludeSymbolsChange={setSymbolsAndResetFilters}
        onScopeToFocusChange={setScopeToFocus}
        onToggleModuleCollapse={toggleModuleCollapse}
        onToggleRelationType={toggleRelationType}
        scopeToFocus={scopeToFocus}
        selectedRelationTypes={selectedRelationTypes}
      />

      <GraphViewer
        collapsedModuleIds={collapsedModuleIds}
        focusedNodeId={focusedNodeId}
        graph={interactiveGraph}
        isError={interactiveGraphQuery.isError}
        isFetching={interactiveGraphQuery.isFetching}
        onFocusNode={setFocusedNodeId}
      />

      {interactiveGraph && focusedNodeId && (
        <FocusedNodeDetails
          graph={interactiveGraph}
          legacyGraphs={legacyGraphs}
          nodeId={focusedNodeId}
          onScopeToFocusedNode={scopeToFocusedNodeNow}
          repoId={repoId}
        />
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
