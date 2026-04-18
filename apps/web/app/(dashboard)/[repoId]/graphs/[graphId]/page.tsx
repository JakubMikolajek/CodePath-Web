'use client'

import type { Nullable } from '@workspace/codepath-common/globals'
import type { Graph } from '@workspace/codepath-common/graph'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import MermaidGraph from '@/components/MermaidGraph'
import { getFirstRouteParam } from '@/lib/route-params'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { getGraphs } from '@/redux/slices/graphsSlice'

export default function Page() {
  const params = useParams()
  const dispatch = useAppDispatch()
  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])
  const graphId = useMemo(() => Number(getFirstRouteParam(params.graphId)), [params.graphId])
  const [activeGraph, setActiveGraph] = useState<Nullable<Graph>>(null)

  const graphs = useAppSelector(state => state.graphs.graphs)
  const loading = useAppSelector(state => state.graphs.loading)

  useEffect(() => {
    if (!Number.isFinite(repoId)) {
      return
    }

    void dispatch(getGraphs(repoId))
  }, [dispatch, repoId])

  useEffect(() => {
    setActiveGraph(graphs.find(graph => graph.id === graphId) ?? null)
  }, [graphId, graphs])

  return (
    <div className="w-full relative bg-background">
      <div className="flex flex-col">
        <h1 className="text-2xl font-semibold text-foreground">Graph</h1>
        {loading && (
          <p className="text-sm text-muted-foreground mt-2">Loading graphs...</p>
        )}
        {!loading && !activeGraph && (
          <p className="text-sm text-muted-foreground mt-2">Graph not found for selected repository.</p>
        )}
        {activeGraph && <MermaidGraph graph={activeGraph.graph} key={activeGraph.id} />}
      </div>
    </div>
  )
}
