import type { Nullable } from '@workspace/codepath-common'
import type { RepoInteractiveGraph } from '@workspace/codepath-common/graph'
import {
  RepoGraphEdgeType,
  RepoGraphNodeType
} from '@workspace/codepath-common/graph'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Layers3, Maximize2, Search, SlidersHorizontal, Target } from 'lucide-react'

interface GraphControlsProps {
  availableRelationTypes: RepoGraphEdgeType[]
  collapsedModuleIds: string[]
  depth: number
  focusedNodeId: Nullable<string>
  graph: Nullable<RepoInteractiveGraph>
  includeSymbols: boolean
  onDepthChange: (depth: number) => void
  onIncludeSymbolsChange: (includeSymbols: boolean) => void
  onScopeToFocusChange: (scopeToFocus: boolean) => void
  onToggleModuleCollapse: (moduleId: string) => void
  onToggleRelationType: (relationType: RepoGraphEdgeType) => void
  scopeToFocus: boolean
  selectedRelationTypes: RepoGraphEdgeType[]
}

const edgeTypeOptions: RepoGraphEdgeType[] = [
  RepoGraphEdgeType.IMPORTS,
  RepoGraphEdgeType.CALLS,
  RepoGraphEdgeType.EXTENDS,
  RepoGraphEdgeType.DEPENDS_ON,
  RepoGraphEdgeType.OWNS,
  RepoGraphEdgeType.PRODUCES,
  RepoGraphEdgeType.CONSUMES
]

export { edgeTypeOptions }

export function GraphControls({
  availableRelationTypes,
  collapsedModuleIds,
  depth,
  focusedNodeId,
  graph,
  includeSymbols,
  onDepthChange,
  onIncludeSymbolsChange,
  onScopeToFocusChange,
  onToggleModuleCollapse,
  onToggleRelationType,
  scopeToFocus,
  selectedRelationTypes
}: GraphControlsProps) {
  const moduleNodes = graph?.nodes.filter(node => node.type === RepoGraphNodeType.MODULE) ?? []

  return (
    <section aria-label="Graph controls" className="rounded-[12px] border border-white/6 bg-white/[0.012] p-[9px_12px]">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-1.75 rounded-[8px] border border-white/10 px-2.75 py-1.5 text-xs text-foreground transition hover:bg-white/3">
          <input
            checked={scopeToFocus}
            className="size-4 accent-primary"
            onChange={event => onScopeToFocusChange(event.target.checked)}
            type="checkbox"
          />

          <Target className="size-3.25 text-primary" />
          Focus mode
        </label>

        <label className="flex items-center gap-2 rounded-[8px] border border-white/10 px-2.75 py-1.5 text-xs text-muted-foreground">
          Depth:
          <Input
            aria-label="Graph traversal depth"
            className="h-6 w-12 rounded-[7px] bg-(--nurt-bg0) px-2 text-center font-mono text-xs"
            max={5}
            min={1}
            onChange={event => onDepthChange(Number(event.target.value))}
            type="number"
            value={depth}
          />
        </label>

        <label className="flex items-center gap-1.75 rounded-[8px] border border-white/10 px-2.75 py-1.5 text-xs text-foreground transition hover:bg-white/3">
          <input
            checked={includeSymbols}
            className="size-4 accent-primary"
            onChange={event => onIncludeSymbolsChange(event.target.checked)}
            type="checkbox"
          />

          <Layers3 className="size-3.25 text-(--nurt-t3)" />
          Include symbols
        </label>

        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-1.75 rounded-[8px] border border-white/10 px-2.75 py-1.5 text-xs text-foreground transition hover:bg-white/3">
            <SlidersHorizontal className="size-3.25" />
            Filters
          </summary>

          <div className="absolute left-0 top-10 z-20 w-[min(38rem,calc(100vw-3rem))] rounded-[14px] border border-white/10 bg-(--nurt-bg2) p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Relation filters</p>

            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {edgeTypeOptions.map(relationType => {
                const isAvailable = availableRelationTypes.includes(relationType)
                const isSelected = selectedRelationTypes.includes(relationType)

                return (
                  <label className={`flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2 transition ${isSelected ? 'border-primary/50 bg-primary/15 text-foreground' : 'border-white/10 bg-white/3 text-muted-foreground'} ${isAvailable ? '' : 'opacity-40'}`} key={relationType}>
                    <input
                      checked={isSelected}
                      className="size-3.5 accent-primary"
                      onChange={() => onToggleRelationType(relationType)}
                      type="checkbox"
                    />
                    {relationType}
                  </label>
                )
              })}
            </div>

            {moduleNodes.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Expand / collapse modules</p>

                <div className="flex max-h-44 flex-wrap gap-2 overflow-auto pr-1">
                  {moduleNodes.map(moduleNode => {
                    const collapsed = collapsedModuleIds.includes(moduleNode.id)

                    return (
                      <button className={`rounded-full border px-3 py-1.5 text-xs transition ${collapsed ? 'border-amber-300/50 bg-amber-300/10 text-amber-200' : 'border-white/10 bg-white/3 text-muted-foreground hover:border-primary/40 hover:text-white'}`} key={moduleNode.id} onClick={() => onToggleModuleCollapse(moduleNode.id)} type="button">
                        {collapsed ? 'Expand' : 'Collapse'} {moduleNode.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </details>

        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Search nodes</span>

          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.25 -translate-y-1/2 text-(--nurt-t3)" />

          <Input className="h-8 rounded-[8px] bg-(--nurt-bg0) pl-8 font-mono text-xs" disabled placeholder="Search nodes..." />
        </label>

        <Button aria-label="Fullscreen graph" className="size-8.5 rounded-[8px] p-0" type="button" variant="glass">
          <Maximize2 className="size-3.75" />
        </Button>
      </div>

      {focusedNodeId && (
        <p className="mt-3 break-all rounded-[8px] border border-primary/25 bg-primary/10 p-3 text-xs text-muted-foreground">
          Focused: <span className="font-medium text-white">{focusedNodeId}</span>
        </p>
      )}
    </section>
  )
}
