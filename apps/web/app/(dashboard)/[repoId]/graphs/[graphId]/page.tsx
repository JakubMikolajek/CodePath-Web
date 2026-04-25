'use client'

import type { Nullable } from '@workspace/codepath-common/globals'
import type { Graph } from '@workspace/codepath-common/graph'
import { Button } from '@workspace/ui/components/button'
import { ArrowLeft, GitFork, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import MermaidGraph from '@/components/MermaidGraph'
import { PageHeader } from '@/components/PageHeader'
import { getFirstRouteParam } from '@/lib/route-params'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { getGraphs } from '@/redux/slices/graphsSlice'

export default function Page() {
  const params = useParams()
  const dispatch = useAppDispatch()
  const graphId = useMemo(() => Number(getFirstRouteParam(params.graphId)), [params.graphId])
  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])
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
    <div className="space-y-6">
      <PageHeader
        actions={(
          <Button asChild variant="glass">
            <Link href={`/${repoId}/graphs`}>
              <ArrowLeft className="size-4" />
              Back to graph explorer
            </Link>
          </Button>
        )}
        description="Legacy per-file Mermaid graph for source-level dependency inspection."
        eyebrow={`Repo ${Number.isFinite(repoId) ? repoId : 'unknown'} · Graph ${Number.isFinite(graphId) ? graphId : 'unknown'}`}
        title="File Graph"
      />

      {loading && (
        <div className="glass-panel rounded-3xl p-6 text-sm text-muted-foreground" role="status">
          Loading graphs...
        </div>
      )}

      {!loading && !activeGraph && (
        <div className="glass-panel rounded-3xl p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-amber-200">
            <TriangleAlert className="size-6" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-white">Graph not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">Selected repository does not expose this legacy per-file graph.</p>
        </div>
      )}

      {activeGraph && (
        <section aria-label="Legacy Mermaid graph" className="glass-panel-strong rounded-[2rem] p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <GitFork className="size-4 text-cyan-300" />
            Mermaid graph preview
          </div>
          <MermaidGraph graph={activeGraph.graph} key={activeGraph.id} />
        </section>
      )}
    </div>
  )
}
