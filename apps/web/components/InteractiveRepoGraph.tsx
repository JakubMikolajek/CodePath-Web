'use client'

import type { Nullable } from '@workspace/codepath-common/globals'
import type {
  RepoGraphEdge,
  RepoGraphNode,
  RepoInteractiveGraph
} from '@workspace/codepath-common/graph'
import { RepoGraphNodeType } from '@workspace/codepath-common/graph'
import { Button } from '@workspace/ui/components/button'
import { Maximize2, Minus, Plus, X } from 'lucide-react'
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
  [RepoGraphNodeType.EXTERNAL_PACKAGE]: { fill: '#322f45', stroke: '#7f8fca' },
  [RepoGraphNodeType.FILE]: { fill: '#08285f', stroke: '#2778ff' },
  [RepoGraphNodeType.MODULE]: { fill: '#341172', stroke: '#8b3dff' },
  [RepoGraphNodeType.REPO]: { fill: '#075c2f', stroke: '#29d967' },
  [RepoGraphNodeType.SYMBOL]: { fill: '#7a3208', stroke: '#fb923c' }
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button
          onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * ZOOM_IN_FACTOR, MIN_SCALE, MAX_SCALE) }))}
          size="sm"
          type="button"
          variant="glass"
        >
          <Plus className="size-3.5" />
          Zoom in
        </Button>

        <Button
          onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * ZOOM_OUT_FACTOR, MIN_SCALE, MAX_SCALE) }))}
          size="sm"
          type="button"
          variant="glass"
        >
          <Minus className="size-3.5" />
          Zoom out
        </Button>

        <Button onClick={() => setViewport(DEFAULT_VIEWPORT)} size="sm" type="button" variant="glass">
          Reset view
        </Button>

        <Button disabled={!focusedNodeId} onClick={() => onFocusNode(null)} size="sm" type="button" variant="glass">
          <X className="size-3.5" />
          Clear focus
        </Button>

        <span className="text-muted-foreground">Layout:</span>

        <Button
          aria-pressed={layoutMode === LayoutMode.CORE_RINGS}
          className={layoutMode === LayoutMode.CORE_RINGS ? 'border-primary/60 bg-primary/15 text-primary' : ''}
          onClick={() => setLayoutMode(LayoutMode.CORE_RINGS)}
          size="sm"
          type="button"
          variant="glass"
        >
          Core Rings
        </Button>

        <Button
          aria-pressed={layoutMode === LayoutMode.LAYERED}
          className={layoutMode === LayoutMode.LAYERED ? 'border-primary/60 bg-primary/15 text-primary' : ''}
          onClick={() => setLayoutMode(LayoutMode.LAYERED)}
          size="sm"
          type="button"
          variant="glass"
        >
          Layered
        </Button>

        <span className="text-muted-foreground">Nodes: {visibleNodes.length}{overviewHiddenCount > 0 ? `/${rawVisibleNodes.length}` : ''}</span>

        <span className="text-muted-foreground">Edges: {visibleEdges.length}</span>

        {overviewHiddenCount > 0 && (
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-primary">
            Overview hides {overviewHiddenCount} low-signal nodes
          </span>
        )}
      </div>

      <div
        className="relative h-[72vh] min-h-160 overflow-hidden rounded-[1.75rem] border border-primary/30 bg-[radial-gradient(circle_at_50%_46%,oklch(0.22_0.13_250/0.22),transparent_34%),radial-gradient(circle_at_46%_56%,oklch(0.2_0.12_152/0.12),transparent_24%),linear-gradient(135deg,oklch(0.12_0.045_258/0.98),oklch(0.055_0.025_264/0.99))] shadow-[inset_0_1px_0_oklch(1_0_0/0.07),0_0_50px_oklch(0.55_0.22_268/0.18)]"
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerUp}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(oklch(0.95_0.03_250/0.045)_1px,transparent_1px)] bg-size-[18px_18px] opacity-45" />

        <svg
          aria-label="Interactive repository graph"
          className="h-full w-full"
          role="img"
          viewBox={`0 0 ${positioned.width} ${positioned.height}`}
        >
          <defs>
            <marker id="arrow" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="6" refY="3">
              <path d="M0,0 L6,3 L0,6 z" fill="#60a5fa" />
            </marker>

            <filter height="180%" id="nodeGlow" width="180%" x="-40%" y="-40%">
              <feGaussianBlur result="coloredBlur" stdDeviation="4" />

              <feMerge>
                <feMergeNode in="coloredBlur" />

                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`}>
            {visibleEdges.map(edge => {
              const sourcePos = positioned.positions.get(edge.source)
              const targetPos = positioned.positions.get(edge.target)

              if (!sourcePos || !targetPos) {
                return null
              }

              const emphasis = getEdgeEmphasis(edge)
              const stroke = emphasis === 'focused' ? '#8b5cf6' : emphasis === 'neighbor' ? '#22d3ee' : emphasis === 'dim' ? '#94a3b82e' : '#2563eb99'
              const strokeWidth = emphasis === 'focused' ? 2.8 : emphasis === 'neighbor' ? 2 : 1.2
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
              const fill = emphasis === 'dim' ? `${palette.fill}66` : palette.fill
              const stroke = emphasis === 'focused' ? '#1d4ed8' : palette.stroke
              const strokeWidth = emphasis === 'focused' ? 3 : emphasis === 'neighbor' ? 2.5 : 2
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
                    filter={emphasis === 'dim' ? undefined : 'url(#nodeGlow)'}
                    height={42}
                    rx={14}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    width={nodeWidth}
                    x={-nodeWidth / 2}
                    y={-21}
                  />

                  <text
                    className="fill-white text-[12.5px] font-semibold"
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
        <div className="pointer-events-none absolute bottom-6 left-6 hidden w-64 rounded-3xl border border-primary/25 bg-slate-950/55 p-4 shadow-[0_0_30px_oklch(0.56_0.2_260/0.16)] backdrop-blur-xl lg:block">
          <div className="relative h-24 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
            <div className="absolute left-7 top-5 h-1.5 w-16 rounded-full bg-blue-500 shadow-[0_0_12px_#2778ff]" />

            <div className="absolute left-16 top-9 h-1.5 w-20 rounded-full bg-violet-500 shadow-[0_0_12px_#8b3dff]" />

            <div className="absolute left-11 top-14 h-1.5 w-28 rounded-full bg-emerald-500 shadow-[0_0_12px_#29d967]" />

            <div className="absolute left-24 top-20 h-1.5 w-24 rounded-full bg-amber-500 shadow-[0_0_12px_#f59e0b]" />

            <div className="absolute inset-x-8 bottom-4 h-10 rounded border border-dashed border-white/35" />
          </div>

          <div className="absolute right-4 top-4 grid gap-2">
            {/* FIXME create button component for that */}
            <button
              aria-label="Zoom graph in"
              className="pointer-events-auto grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white"
              onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * ZOOM_IN_FACTOR, MIN_SCALE, MAX_SCALE) }))}
              type="button"
            >
              <Plus className="size-4" />
            </button>

            {/* FIXME create button component for that */}
            <button
              aria-label="Zoom graph out"
              className="pointer-events-auto grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white"
              onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * ZOOM_OUT_FACTOR, MIN_SCALE, MAX_SCALE) }))}
              type="button"
            >
              <Minus className="size-4" />
            </button>

            {/* FIXME create button component for that */}
            <button
              aria-label="Reset graph view"
              className="pointer-events-auto grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white"
              onClick={() => setViewport(DEFAULT_VIEWPORT)}
              type="button"
            >
              <Maximize2 className="size-4" />
            </button>
          </div>
        </div>
        <div className="pointer-events-none absolute right-6 top-1/2 hidden -translate-y-1/2 rounded-3xl border border-primary/25 bg-slate-950/55 p-6 shadow-[0_0_30px_oklch(0.56_0.2_260/0.16)] backdrop-blur-xl xl:block">
          <div className="space-y-5 text-sm font-medium text-slate-200">
            <div className="flex items-center gap-3"><span className="size-3 rounded-full bg-blue-500 shadow-[0_0_12px_#2778ff]" />Core</div>

            <div className="flex items-center gap-3"><span className="size-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#29d967]" />Services</div>

            <div className="flex items-center gap-3"><span className="size-3 rounded-full bg-violet-500 shadow-[0_0_12px_#8b3dff]" />Modules</div>

            <div className="flex items-center gap-3"><span className="size-3 rounded-full bg-orange-400 shadow-[0_0_12px_#fb923c]" />Utils</div>

            <div className="flex items-center gap-3"><span className="size-3 rounded-full bg-slate-500 shadow-[0_0_12px_#7f8fca]" />External</div>
          </div>
        </div>
      </div>
    </div>
  )
}
