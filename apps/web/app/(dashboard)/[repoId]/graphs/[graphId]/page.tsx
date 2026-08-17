'use client'

import { Button } from '@workspace/ui/components/button'
import { ArrowLeft, GitFork, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo } from 'react'

import MermaidGraph from '@/components/MermaidGraph'
import { PageHeader } from '@/components/PageHeader'
import { getFirstRouteParam } from '@/lib/route-params'
import { useGetRepoGraphsQuery } from '@/redux/api/graphsApi'

export default function Page() {
  const params = useParams()

  const graphId = useMemo(() => Number(getFirstRouteParam(params.graphId)), [params.graphId])
  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const graphsQuery = useGetRepoGraphsQuery(repoId, {
    refetchOnMountOrArgChange: true,
    skip: !Number.isFinite(repoId)
  })

  const graphs = graphsQuery.currentData ?? []
  const activeGraph = graphs.find(graph => graph.id === graphId) ?? null

  return (
    <div className="space-y-4.5">
      <PageHeader
        actions={(
          <Button
            asChild
            className="rounded-[9px] px-3.25 py-2 text-[12.5px]"
            variant="glass"
          >
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

      {graphsQuery.isFetching && (
        <div className="nurt-panel p-6 text-sm text-muted-foreground" role="status">
          Loading graphs...
        </div>
      )}

      {!graphsQuery.isFetching && !activeGraph && (
        <div className="nurt-panel p-8 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-[14px] border border-amber-300/30 bg-amber-300/10 text-amber-200">
            <TriangleAlert className="size-6" />
          </div>

          <h2 className="mt-4 text-xl font-semibold tracking-normal text-foreground">Graph not found</h2>

          <p className="mt-2 text-sm text-muted-foreground">Selected repository does not expose this legacy per-file graph.</p>
        </div>
      )}

      {activeGraph && (
        <section aria-label="Legacy Mermaid graph" className="nurt-panel p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <GitFork className="size-4 text-cyan-300" />
            Mermaid graph preview
          </div>

          <MermaidGraph
            graph={activeGraph.graph}
            key={activeGraph.id}
          />
        </section>
      )}
    </div>
  )
}
