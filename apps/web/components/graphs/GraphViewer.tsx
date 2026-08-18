import type { Nullable } from '@workspace/codepath-common'
import type { RepoInteractiveGraph } from '@workspace/codepath-common/graph'

import InteractiveRepoGraph from '@/components/InteractiveRepoGraph'

interface GraphViewerProps {
  collapsedModuleIds: string[]
  focusedNodeId: Nullable<string>
  graph: Nullable<RepoInteractiveGraph>
  isError: boolean
  isFetching: boolean
  onFocusNode: (nodeId: Nullable<string>) => void
}

export function GraphViewer({
  collapsedModuleIds,
  focusedNodeId,
  graph,
  isError,
  isFetching,
  onFocusNode
}: GraphViewerProps) {
  return (
    <>
      {isFetching && (
        <div className="nurt-panel p-6 text-sm text-muted-foreground" role="status">
          Loading interactive graph...
        </div>
      )}

      {!isFetching && isError && (
        <div className="nurt-panel p-8 text-center text-sm text-muted-foreground">
          Unable to load graph data for this repository.
        </div>
      )}

      {!isFetching && !isError && !graph && (
        <div className="nurt-panel p-8 text-center text-sm text-muted-foreground">
          No graph data available for this repository yet.
        </div>
      )}

      {graph && (
        <>
          <section aria-label="Interactive repository graph" className="h-[calc(100svh-290px)] min-h-112.5 overflow-hidden rounded-[14px] border border-white/10 bg-[radial-gradient(110%_90%_at_50%_40%,#0c1018_0%,#07090d_70%)] p-0">
            <InteractiveRepoGraph
              collapsedModuleIds={collapsedModuleIds}
              focusedNodeId={focusedNodeId}
              graph={graph}
              onFocusNode={onFocusNode}
            />
          </section>

          {graph.metadata.truncated && (
            <div className="rounded-[14px] border border-amber-300/35 bg-amber-300/10 p-4 text-xs text-amber-100">
              Graph view is truncated for responsiveness ({graph.metadata.truncationReason ?? 'limits applied'}).
              Use filters/focus or disable symbols to inspect a smaller subgraph.
            </div>
          )}

          <div className="nurt-panel p-4 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {graph.metadata.topologyMode && (
                <span>Topology mode: {graph.metadata.topologyMode}</span>
              )}

              {graph.metadata.importResolution && (
                <span>
                  Import resolution: {graph.metadata.importResolution.resolved ?? 0}/

                  {graph.metadata.importResolution.total ?? 0}

                  {typeof graph.metadata.importResolution.ratio === 'number' ? ` (${Math.round(graph.metadata.importResolution.ratio * 100)}%)` : ''}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
