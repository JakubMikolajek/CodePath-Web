'use client'

import type { Nullable } from '@workspace/codepath-common/globals'
import type {
  RepoGraphEdge,
  RepoGraphNode,
  RepoInteractiveGraph
} from '@workspace/codepath-common/graph'
import { RepoGraphNodeType } from '@workspace/codepath-common/graph'
import { Button } from '@workspace/ui/components/button'
import { Minus, Plus, X } from 'lucide-react'
import { type PointerEventHandler, useMemo, useState, type WheelEventHandler } from 'react'

interface InteractiveRepoGraphProps {
  collapsedModuleIds: string[]
  focusedNodeId: Nullable<string>
  graph: RepoInteractiveGraph
  onFocusNode: (nodeId: Nullable<string>) => void
}

enum LayoutMode {
  CORE_RINGS = 'coreRings',
  LAYERED = 'layered'
}

interface PositionedGraph {
  height: number
  positions: Map<string, { x: number, y: number }>
  width: number
}

const NODE_TYPE_ORDER: RepoGraphNodeType[] = [
  RepoGraphNodeType.REPO,
  RepoGraphNodeType.MODULE,
  RepoGraphNodeType.FILE,
  RepoGraphNodeType.SYMBOL,
  RepoGraphNodeType.EXTERNAL_PACKAGE
]
const NODE_TYPE_COLORS: Record<RepoGraphNodeType, { fill: string, stroke: string }> = {
  [RepoGraphNodeType.EXTERNAL_PACKAGE]: { fill: '#272b32', stroke: '#9aa6b4' },
  [RepoGraphNodeType.FILE]: { fill: '#1c322f', stroke: '#5fd0a0' },
  [RepoGraphNodeType.MODULE]: { fill: '#241e3e', stroke: '#8b5cf6' },
  [RepoGraphNodeType.REPO]: { fill: '#192a3e', stroke: '#4ea3f5' },
  [RepoGraphNodeType.SYMBOL]: { fill: '#392a20', stroke: '#fd9f4d' }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const truncate = (value: string, maxLength: number) => value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value

const OVERVIEW_NODE_LIMIT = 72
const MIN_SCALE = 0.22
const MAX_SCALE = 7
const ZOOM_IN_FACTOR = 1.16
const ZOOM_OUT_FACTOR = 0.86
const DEFAULT_VIEWPORT = { scale: 1, x: 0, y: 0 }

function getDegreeByNode(edges: RepoGraphEdge[]) {
  const degreeByNode = new Map<string, number>()

  for (const edge of edges) {
    degreeByNode.set(edge.source, (degreeByNode.get(edge.source) ?? 0) + 1)
    degreeByNode.set(edge.target, (degreeByNode.get(edge.target) ?? 0) + 1)
  }

  return degreeByNode
}

function getOverviewNodes(nodes: RepoGraphNode[], edges: RepoGraphEdge[], focusedNodeId: Nullable<string>) {
  if (nodes.length <= OVERVIEW_NODE_LIMIT || focusedNodeId) return nodes

  const degreeByNode = getDegreeByNode(edges)

  const typeWeight: Record<RepoGraphNodeType, number> = {
    [RepoGraphNodeType.EXTERNAL_PACKAGE]: 90,
    [RepoGraphNodeType.FILE]: 130,
    [RepoGraphNodeType.MODULE]: 520,
    [RepoGraphNodeType.REPO]: 900,
    [RepoGraphNodeType.SYMBOL]: 60
  }

  const selectedIds = new Set([...nodes].sort((a, b) => {
    const scoreA = (degreeByNode.get(a.id) ?? 0) * 9 + typeWeight[a.type]
    const scoreB = (degreeByNode.get(b.id) ?? 0) * 9 + typeWeight[b.type]

    if (scoreA !== scoreB) return scoreB - scoreA

    return a.label.localeCompare(b.label)
  }).slice(0, OVERVIEW_NODE_LIMIT).map(node => node.id)
  )

  return nodes.filter(node => selectedIds.has(node.id))
}

function buildLayeredLayout(visibleNodes: RepoGraphNode[]): PositionedGraph {
  const grouped = new Map<RepoGraphNodeType, RepoGraphNode[]>()

  for (const type of NODE_TYPE_ORDER) {
    grouped.set(type, [])
  }

  for (const node of visibleNodes) {
    grouped.get(node.type)?.push(node)
  }

  for (const [type, nodes] of grouped.entries()) {
    grouped.set(type, [...nodes].sort((a, b) => a.label.localeCompare(b.label)))
  }

  const positions = new Map<string, { x: number, y: number }>()

  const targetRowsPerColumn = clamp(Math.round(Math.sqrt(Math.max(visibleNodes.length, 1)) * 1.55), 8, 26)
  const rowGap = 88
  const innerColumnGap = 220
  const typeGap = 120
  const minTypeWidth = 250
  const baseX = 120
  const baseY = 110

  let maxRowsInColumn = 1
  let currentX = baseX

  NODE_TYPE_ORDER.forEach(type => {
    const nodes = grouped.get(type) ?? []
    const columns = Math.max(1, Math.ceil(nodes.length / targetRowsPerColumn))

    maxRowsInColumn = Math.max(maxRowsInColumn, Math.min(nodes.length, targetRowsPerColumn))

    nodes.forEach((node, index) => {
      const columnIndex = Math.floor(index / targetRowsPerColumn)
      const rowIndex = index % targetRowsPerColumn

      positions.set(node.id, {
        x: currentX + columnIndex * innerColumnGap,
        y: baseY + rowIndex * rowGap
      })
    })

    const typeWidth = Math.max(minTypeWidth, (columns - 1) * innerColumnGap + minTypeWidth)
    currentX += typeWidth + typeGap
  })

  const width = Math.max(1480, currentX + 220)
  const height = Math.max(860, baseY + maxRowsInColumn * rowGap + 220)

  return { height, positions, width }
}

function buildCoreRingsLayout(visibleNodes: RepoGraphNode[], visibleEdges: RepoGraphEdge[]): PositionedGraph {
  if (visibleNodes.length === 0) return { height: 860, positions: new Map(), width: 1480 }

  const nodeById = new Map(visibleNodes.map(node => [node.id, node]))
  const adjacency = new Map<string, Set<string>>()

  visibleNodes.forEach(node => adjacency.set(node.id, new Set()))

  for (const edge of visibleEdges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue

    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  }

  const typePriority: Record<RepoGraphNodeType, number> = {
    [RepoGraphNodeType.EXTERNAL_PACKAGE]: 1,
    [RepoGraphNodeType.FILE]: 3,
    [RepoGraphNodeType.MODULE]: 6,
    [RepoGraphNodeType.REPO]: 9,
    [RepoGraphNodeType.SYMBOL]: 2
  }

  const nodeScore = (node: RepoGraphNode) => {
    const degree = adjacency.get(node.id)?.size ?? 0
    return degree * 3 + (typePriority[node.type] ?? 0)
  }

  const coreCount = 1
  const sortedByScore = [...visibleNodes].sort((a, b) => {
    const scoreDelta = nodeScore(b) - nodeScore(a)

    if (scoreDelta !== 0) return scoreDelta

    return a.label.localeCompare(b.label)
  })

  const coreIds = new Set(sortedByScore.slice(0, coreCount).map(node => node.id))
  const repoNode = visibleNodes.find(node => node.type === RepoGraphNodeType.REPO)

  if (repoNode) coreIds.add(repoNode.id)

  while (coreIds.size > coreCount) {
    const removable = [...coreIds].map(id => nodeById.get(id))
      .filter((node): node is RepoGraphNode => node !== undefined && node.id !== repoNode?.id)
      .sort((a, b) => {
        const scoreDelta = nodeScore(a) - nodeScore(b)

        if (scoreDelta !== 0) return scoreDelta

        return a.label.localeCompare(b.label)
      })[0]

    if (!removable) break

    coreIds.delete(removable.id)
  }

  const depthByNode = new Map<string, number>()
  const bfsQueue: string[] = [...coreIds]

  for (const id of coreIds) {
    depthByNode.set(id, 0)
  }

  while (bfsQueue.length > 0) {
    const currentId = bfsQueue.shift()

    if (!currentId) break

    const currentDepth = depthByNode.get(currentId) ?? 0
    const neighbors = adjacency.get(currentId)

    if (!neighbors) continue

    for (const neighborId of neighbors) {
      if (depthByNode.has(neighborId)) continue

      depthByNode.set(neighborId, currentDepth + 1)
      bfsQueue.push(neighborId)
    }
  }

  let maxDepth = 0

  for (const value of depthByNode.values()) {
    maxDepth = Math.max(maxDepth, value)
  }

  const fallbackDepth = maxDepth + 1
  const rings = new Map<number, RepoGraphNode[]>()

  for (const node of visibleNodes) {
    const depth = depthByNode.get(node.id) ?? fallbackDepth

    if (!rings.has(depth)) rings.set(depth, [])

    rings.get(depth)?.push(node)
  }

  const typeOrder = new Map<RepoGraphNodeType, number>()
  NODE_TYPE_ORDER.forEach((type, index) => typeOrder.set(type, index))

  for (const [depth, nodes] of rings.entries()) {
    rings.set(depth, [...nodes].sort((a, b) => {
      const typeDelta = (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99)

      if (typeDelta !== 0) return typeDelta

      return a.label.localeCompare(b.label)
    }))
  }

  const relativePositions = new Map<string, { x: number, y: number }>()
  const sortedRingDepths = [...rings.keys()].sort((a, b) => a - b)
  const coreNodes = rings.get(0) ?? []

  if (coreNodes.length === 1) {
    relativePositions.set(coreNodes[0].id, { x: 0, y: 0 })
  } else if (coreNodes.length > 1) {
    const coreRadius = 92

    coreNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / coreNodes.length - Math.PI / 2

      relativePositions.set(node.id, {
        x: Math.cos(angle) * coreRadius,
        y: Math.sin(angle) * coreRadius
      })
    })
  }

  const firstRingRadius = coreNodes.length > 0 ? 230 : 140
  const ringGap = 165

  sortedRingDepths.filter(depth => depth > 0).forEach(depth => {
    const nodes = rings.get(depth) ?? []

    if (nodes.length === 0) return

    const radius = firstRingRadius + (depth - 1) * ringGap

    nodes.forEach((node, index) => {
      const angleOffset = depth % 2 === 0 ? Math.PI / nodes.length : 0
      const angle = (2 * Math.PI * index) / nodes.length + angleOffset - Math.PI / 2

      relativePositions.set(node.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius
      })
    })
  })

  let maxAbsX = 0
  let maxAbsY = 0

  for (const pos of relativePositions.values()) {
    maxAbsX = Math.max(maxAbsX, Math.abs(pos.x))
    maxAbsY = Math.max(maxAbsY, Math.abs(pos.y))
  }

  const width = Math.max(1480, Math.round((maxAbsX + 260) * 2))
  const height = Math.max(860, Math.round((maxAbsY + 260) * 2))
  const centerX = width / 2
  const centerY = height / 2

  const positions = new Map<string, { x: number, y: number }>()

  for (const node of visibleNodes) {
    const relative = relativePositions.get(node.id) ?? { x: 0, y: 0 }

    positions.set(node.id, {
      x: centerX + relative.x,
      y: centerY + relative.y
    })
  }

  return { height, positions, width }
}

export default function InteractiveRepoGraph({ collapsedModuleIds, focusedNodeId, graph, onFocusNode }: InteractiveRepoGraphProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(LayoutMode.CORE_RINGS)
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [dragStart, setDragStart] = useState<null | { pointerX: number, pointerY: number, startX: number, startY: number }>(null)

  const hiddenNodeIds = useMemo(() => {
    const collapsed = new Set(collapsedModuleIds)
    const ids = new Set<string>()

    for (const node of graph.nodes) {
      const moduleId = node.metadata?.moduleId

      if (!moduleId || !collapsed.has(moduleId)) continue
      if (
        (node.type === RepoGraphNodeType.FILE || node.type === RepoGraphNodeType.SYMBOL)
        && node.id !== focusedNodeId
      ) {
        ids.add(node.id)
      }
    }

    return ids
  }, [collapsedModuleIds, focusedNodeId, graph.nodes])

  const rawVisibleNodes = useMemo(() => graph.nodes.filter(node => !hiddenNodeIds.has(node.id)), [graph.nodes, hiddenNodeIds])
  const rawVisibleNodeIdSet = useMemo(() => new Set(rawVisibleNodes.map(node => node.id)), [rawVisibleNodes])
  const rawVisibleEdges = useMemo(() => graph.edges.filter(
    edge => rawVisibleNodeIdSet.has(edge.source) && rawVisibleNodeIdSet.has(edge.target)), [graph.edges, rawVisibleNodeIdSet]
  )
  const visibleNodes = useMemo(() => getOverviewNodes(rawVisibleNodes, rawVisibleEdges, focusedNodeId), [focusedNodeId, rawVisibleEdges, rawVisibleNodes])

  const overviewHiddenCount = rawVisibleNodes.length - visibleNodes.length

  const visibleNodeIdSet = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes])
  const visibleEdges = useMemo(() => rawVisibleEdges.filter(
    edge => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target)), [rawVisibleEdges, visibleNodeIdSet]
  )

  const positioned = useMemo(() => {
    if (layoutMode === LayoutMode.CORE_RINGS) return buildCoreRingsLayout(visibleNodes, visibleEdges)

    return buildLayeredLayout(visibleNodes)
  }, [layoutMode, visibleEdges, visibleNodes])

  const focusedNeighborIds = useMemo(() => {
    if (!focusedNodeId) return new Set<string>()

    const neighbors = new Set<string>()

    for (const edge of visibleEdges) {
      if (edge.source === focusedNodeId) neighbors.add(edge.target)
      if (edge.target === focusedNodeId) neighbors.add(edge.source)
    }

    return neighbors
  }, [focusedNodeId, visibleEdges])

  const showEdgeLabels = viewport.scale >= 1.5 && visibleEdges.length <= 120

  const handleWheel: WheelEventHandler<HTMLDivElement> = event => {
    event.preventDefault()

    const factor = event.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR

    setViewport(prev => ({
      ...prev,
      scale: clamp(prev.scale * factor, MIN_SCALE, MAX_SCALE)
    }))
  }

  const handlePointerDown: PointerEventHandler<HTMLDivElement> = event => {
    setDragStart({
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: viewport.x,
      startY: viewport.y
    })
  }

  const handlePointerMove: PointerEventHandler<HTMLDivElement> = event => {
    if (!dragStart) return

    setViewport(prev => ({
      ...prev,
      x: dragStart.startX + (event.clientX - dragStart.pointerX),
      y: dragStart.startY + (event.clientY - dragStart.pointerY)
    }))
  }

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = () => setDragStart(null)

  const getNodeEmphasis = (nodeId: string) => {
    if (!focusedNodeId) {
      // FIXME add enum values
      return 'default'
    }

    if (nodeId === focusedNodeId) {
      // FIXME add enum values
      return 'focused'
    }

    if (focusedNeighborIds.has(nodeId)) {
      // FIXME add enum values
      return 'neighbor'
    }

    // FIXME add enum values
    return 'dim'
  }

  const getEdgeEmphasis = (edge: RepoGraphEdge) => {
    if (!focusedNodeId) {
      // FIXME add enum values
      return 'default'
    }

    if (edge.source === focusedNodeId || edge.target === focusedNodeId) {
      // FIXME add enum values
      return 'focused'
    }

    if (focusedNeighborIds.has(edge.source) || focusedNeighborIds.has(edge.target)) {
      // FIXME add enum values
      return 'neighbor'
    }

    // FIXME add enum values
    return 'dim'
  }

  return (
    <div className="relative h-full min-h-[560px]">
      <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-[7px] rounded-[10px] border border-white/10 bg-[rgba(11,14,20,0.82)] p-[5px] text-xs">
        <Button
          className="size-[26px] rounded-[6px] p-0"
          onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * ZOOM_IN_FACTOR, MIN_SCALE, MAX_SCALE) }))}
          size="sm"
          type="button"
          variant="glass"
        >
          <Plus className="size-[13px]" />
        </Button>

        <Button
          className="size-[26px] rounded-[6px] p-0"
          onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * ZOOM_OUT_FACTOR, MIN_SCALE, MAX_SCALE) }))}
          size="sm"
          type="button"
          variant="glass"
        >
          <Minus className="size-[13px]" />
        </Button>

        <Button className="h-[26px] rounded-[6px] px-2 text-[11.5px]" onClick={() => setViewport(DEFAULT_VIEWPORT)} size="sm" type="button" variant="glass">
          Reset view
        </Button>

        <Button className="h-[26px] rounded-[6px] px-2 text-[11.5px]" disabled={!focusedNodeId} onClick={() => onFocusNode(null)} size="sm" type="button" variant="glass">
          <X className="size-[12px]" />
          Clear focus
        </Button>

        <span className="h-4 w-px bg-white/10" />
        <span className="text-[10.5px] text-[var(--nurt-t3)]">Layout</span>

        <Button
          aria-pressed={layoutMode === LayoutMode.CORE_RINGS}
          className={layoutMode === LayoutMode.CORE_RINGS ? 'h-[26px] rounded-[6px] border-primary/40 bg-primary/20 px-[9px] text-[11px] text-primary' : 'h-[26px] rounded-[6px] px-[9px] text-[11px]'}
          onClick={() => setLayoutMode(LayoutMode.CORE_RINGS)}
          size="sm"
          type="button"
          variant="glass"
        >
          Core Rings
        </Button>

        <Button
          aria-pressed={layoutMode === LayoutMode.LAYERED}
          className={layoutMode === LayoutMode.LAYERED ? 'h-[26px] rounded-[6px] border-primary/40 bg-primary/20 px-[9px] text-[11px] text-primary' : 'h-[26px] rounded-[6px] px-[9px] text-[11px]'}
          onClick={() => setLayoutMode(LayoutMode.LAYERED)}
          size="sm"
          type="button"
          variant="glass"
        >
          Layered
        </Button>

      </div>

      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-[3px] rounded-[10px] border border-white/10 bg-[rgba(11,14,20,0.82)] px-[11px] py-[7px]">
        <span className="font-mono text-[10.5px] text-muted-foreground">Nodes {visibleNodes.length}{overviewHiddenCount > 0 ? `/${rawVisibleNodes.length}` : ''}&nbsp;&nbsp;·&nbsp;&nbsp;Edges {visibleEdges.length}</span>

        {overviewHiddenCount > 0 && (
          <span className="font-mono text-[10px] text-primary">
            Overview hides {overviewHiddenCount} low-signal nodes
          </span>
        )}
      </div>

      <div
        className="relative h-full min-h-[560px] overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <svg
          aria-label="Interactive repository graph"
          className="h-full w-full"
          role="img"
          viewBox={`0 0 ${positioned.width} ${positioned.height}`}
        >
          <defs>
            <marker id="arrow" markerHeight="5" markerWidth="5" orient="auto-start-reverse" refX="5" refY="2.5">
              <path d="M0,0 L5,2.5 L0,5 z" fill="rgba(255,255,255,0.25)" />
            </marker>
          </defs>

          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`}>
            {visibleEdges.map(edge => {
              const sourcePos = positioned.positions.get(edge.source)
              const targetPos = positioned.positions.get(edge.target)

              if (!sourcePos || !targetPos) {
                return null
              }

              const emphasis = getEdgeEmphasis(edge)
              const stroke = emphasis === 'focused' ? '#4ea3f5' : emphasis === 'neighbor' ? 'rgba(255,255,255,0.35)' : emphasis === 'dim' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.14)'
              const strokeWidth = emphasis === 'focused' ? 2 : emphasis === 'neighbor' ? 1.5 : 0.9
              const midpointX = (sourcePos.x + targetPos.x) / 2
              const midpointY = (sourcePos.y + targetPos.y) / 2

              return (
                <g key={edge.id}>
                  <line
                    markerEnd="url(#arrow)"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    x1={sourcePos.x}
                    x2={targetPos.x}
                    y1={sourcePos.y}
                    y2={targetPos.y}
                  />

                  {showEdgeLabels && (
                    <text
                      className="fill-muted-foreground text-[9px]"
                      textAnchor="middle"
                      x={midpointX}
                      y={midpointY - 4}
                    >
                      {edge.type}
                    </text>
                  )}
                </g>
              )
            })}

            {visibleNodes.map(node => {
              const pos = positioned.positions.get(node.id)

              if (!pos) {
                return null
              }

              const emphasis = getNodeEmphasis(node.id)
              const palette = NODE_TYPE_COLORS[node.type]
              const fill = emphasis === 'dim' ? palette.fill + '44' : palette.fill
              const stroke = emphasis === 'focused' ? palette.stroke : emphasis === 'dim' ? palette.stroke + '44' : palette.stroke + 'aa'
              const strokeWidth = emphasis === 'focused' ? 2 : emphasis === 'neighbor' ? 1.5 : 1
              const maxLabelLength = viewport.scale >= 3 ? 56 : viewport.scale >= 2 ? 42 : viewport.scale >= 1.3 ? 32 : 26
              const label = truncate(node.label, maxLabelLength)
              const nodeWidth = Math.max(126, Math.min(320, label.length * 7.2 + 42))

              return (
                <g
                  className="cursor-pointer"
                  key={node.id}
                  onClick={() => onFocusNode(node.id === focusedNodeId ? null : node.id)}
                  transform={`translate(${pos.x}, ${pos.y})`}
                >
                  <rect
                    fill={fill}
                    height={38}
                    rx={7}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    width={nodeWidth}
                    x={-nodeWidth / 2}
                    y={-19}
                  />

                  <text
                    className="fill-white font-mono text-[9.5px]"
                    textAnchor="middle"
                    x={0}
                    y={5}
                  >
                    {label}
                  </text>
                  <title>{`${node.label} (${node.type})`}</title>
                </g>
              )
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute bottom-4 right-4 hidden rounded-[11px] border border-white/10 bg-[rgba(13,16,22,0.88)] p-[10px_13px] xl:block">
          <div className="space-y-[6px] font-mono text-[10.5px] text-[var(--nurt-t3)]">
            <div className="flex items-center gap-2"><span className="size-[7px] rounded-full" style={{ background: '#4ea3f5' }} />Repo</div>
            <div className="flex items-center gap-2"><span className="size-[7px] rounded-full" style={{ background: '#5fd0a0' }} />File</div>
            <div className="flex items-center gap-2"><span className="size-[7px] rounded-full" style={{ background: '#8b5cf6' }} />Module</div>
            <div className="flex items-center gap-2"><span className="size-[7px] rounded-full" style={{ background: '#fd9f4d' }} />Symbol</div>
            <div className="flex items-center gap-2"><span className="size-[7px] rounded-full" style={{ background: '#9aa6b4' }} />External</div>
          </div>
        </div>
      </div>
    </div>
  )
}
