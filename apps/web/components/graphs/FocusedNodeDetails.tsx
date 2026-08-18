import type { RepoInteractiveGraph } from '@workspace/codepath-common/graph'
import { RepoGraphNodeType } from '@workspace/codepath-common/graph'
import { Button } from '@workspace/ui/components/button'
import { Focus, GitFork } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

import { normalizeFilePath } from './graphUtils'

interface FocusedNodeDetailsProps {
  graph: RepoInteractiveGraph
  legacyGraphs: { fileName: string; id: number }[]
  nodeId: string
  onScopeToFocusedNode: () => void
  repoId: number
}

export function FocusedNodeDetails({
  graph,
  legacyGraphs,
  nodeId,
  onScopeToFocusedNode,
  repoId
}: FocusedNodeDetailsProps) {
  const nodeById = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph])

  const focusedNode = nodeById.get(nodeId)

  const focusedFilePath = useMemo(() => {
    if (!focusedNode) return null
    if (focusedNode.type === RepoGraphNodeType.FILE) return normalizeFilePath(focusedNode.metadata?.filePath ?? focusedNode.label)
    if (focusedNode.type === RepoGraphNodeType.SYMBOL && focusedNode.metadata?.filePath) return normalizeFilePath(focusedNode.metadata.filePath)

    return null
  }, [focusedNode])

  const focusedPath = useMemo(() => {
    if (!focusedNode) return [] as string[]

    const path: string[] = [graph.metadata.repoName]
    const moduleNode = focusedNode.metadata?.moduleId ? nodeById.get(focusedNode.metadata.moduleId) : null

    if (moduleNode?.label) path.push(moduleNode.label)

    if (focusedNode.type === RepoGraphNodeType.SYMBOL && focusedFilePath) path.push(focusedFilePath)

    path.push(focusedNode.label)

    return path
  }, [focusedFilePath, focusedNode, graph, nodeById])

  const focusedLegacyGraphId = useMemo(() => {
    if (!focusedFilePath) return null

    return legacyGraphs.find(
      legacyGraph => normalizeFilePath(legacyGraph.fileName) === focusedFilePath
    )?.id ?? null
  }, [focusedFilePath, legacyGraphs])

  if (!focusedNode) return null

  return (
    <section aria-label="Focused node details" className="nurt-panel p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Focused node</p>

          <h2 className="mt-2 text-xl font-semibold tracking-normal text-foreground">
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
          <Button onClick={onScopeToFocusedNode} type="button" variant="glass">
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
  )
}
