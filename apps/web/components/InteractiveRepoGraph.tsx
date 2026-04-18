'use client'

import type {
  RepoGraphEdge,
  RepoGraphNode,
  RepoGraphNodeType,
  RepoInteractiveGraph
} from '@workspace/codepath-common/graph'
import { type PointerEventHandler, useMemo, useState, type WheelEventHandler } from 'react'

interface InteractiveRepoGraphProps {
  collapsedModuleIds: string[]
  focusedNodeId: null | string
  graph: RepoInteractiveGraph
  onFocusNode: (nodeId: null | string) => void
}

type LayoutMode = 'coreRings' | 'layered'
type PositionedGraph = {
  height: number
  positions: Map<string, { x: number, y: number }>
  width: number
}

const NODE_TYPE_ORDER: RepoGraphNodeType[] = ['repo', 'module', 'file', 'symbol', 'external_package']
const NODE_TYPE_COLORS: Record<RepoGraphNodeType, { fill: string, stroke: string }> = {
  external_package: { fill: '#fef3c7', stroke: '#f59e0b' },
  file: { fill: '#dbeafe', stroke: '#2563eb' },
  module: { fill: '#dcfce7', stroke: '#16a34a' },
  repo: { fill: '#e2e8f0', stroke: '#334155' },
  symbol: { fill: '#f5d0fe', stroke: '#a21caf' }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const truncate = (value: string, maxLength: number) => value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
const MIN_SCALE = 0.22
const MAX_SCALE = 7
const ZOOM_IN_FACTOR = 1.16
const ZOOM_OUT_FACTOR = 0.86
const DEFAULT_VIEWPORT = { scale: 1, x: 80, y: 56 }

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

  return {
    height,
    positions,
    width
  }
}

function buildCoreRingsLayout(visibleNodes: RepoGraphNode[], visibleEdges: RepoGraphEdge[]): PositionedGraph {
  if (visibleNodes.length === 0) {
    return {
      height: 860,
      positions: new Map(),
      width: 1480
    }
  }

  const nodeById = new Map(visibleNodes.map(node => [node.id, node]))
  const adjacency = new Map<string, Set<string>>()
  visibleNodes.forEach(node => adjacency.set(node.id, new Set()))

  for (const edge of visibleEdges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) {
      continue
    }
    adjacency.get(edge.source)?.add(edge.target)
    adjacency.get(edge.target)?.add(edge.source)
  }

  const typePriority: Record<RepoGraphNodeType, number> = {
    external_package: 1,
    file: 3,
    module: 6,
    repo: 9,
    symbol: 2
  }

  const nodeScore = (node: RepoGraphNode) => {
    const degree = adjacency.get(node.id)?.size ?? 0
    return degree * 3 + (typePriority[node.type] ?? 0)
  }

  const coreCount = Math.min(
    visibleNodes.length,
    clamp(Math.round(Math.sqrt(Math.max(visibleNodes.length, 1))), 1, 14)
  )
  const sortedByScore = [...visibleNodes].sort((a, b) => {
    const scoreDelta = nodeScore(b) - nodeScore(a)
    if (scoreDelta !== 0) {
      return scoreDelta
    }
    return a.label.localeCompare(b.label)
  })

  const coreIds = new Set(sortedByScore.slice(0, coreCount).map(node => node.id))
  const repoNode = visibleNodes.find(node => node.type === 'repo')
  if (repoNode) {
    coreIds.add(repoNode.id)
  }

  while (coreIds.size > coreCount) {
    const removable = [...coreIds]
      .map(id => nodeById.get(id))
      .filter((node): node is RepoGraphNode => node !== undefined && node.id !== repoNode?.id)
      .sort((a, b) => {
        const scoreDelta = nodeScore(a) - nodeScore(b)
        if (scoreDelta !== 0) {
          return scoreDelta
        }
        return a.label.localeCompare(b.label)
      })[0]

    if (!removable) {
      break
    }
    coreIds.delete(removable.id)
  }

  const depthByNode = new Map<string, number>()
  const bfsQueue: string[] = [...coreIds]
  for (const id of coreIds) {
    depthByNode.set(id, 0)
  }

  while (bfsQueue.length > 0) {
    const currentId = bfsQueue.shift()
    if (!currentId) {
      break
    }

    const currentDepth = depthByNode.get(currentId) ?? 0
    const neighbors = adjacency.get(currentId)
    if (!neighbors) {
      continue
    }

    for (const neighborId of neighbors) {
      if (depthByNode.has(neighborId)) {
        continue
      }
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
    if (!rings.has(depth)) {
      rings.set(depth, [])
    }
    rings.get(depth)?.push(node)
  }

  const typeOrder = new Map<RepoGraphNodeType, number>()
  NODE_TYPE_ORDER.forEach((type, index) => typeOrder.set(type, index))

  for (const [depth, nodes] of rings.entries()) {
    rings.set(depth, [...nodes].sort((a, b) => {
      const typeDelta = (typeOrder.get(a.type) ?? 99) - (typeOrder.get(b.type) ?? 99)
      if (typeDelta !== 0) {
        return typeDelta
      }
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

  sortedRingDepths
    .filter(depth => depth > 0)
    .forEach(depth => {
      const nodes = rings.get(depth) ?? []
      if (nodes.length === 0) {
        return
      }

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

  return {
    height,
    positions,
    width
  }
}

export default function InteractiveRepoGraph({
  collapsedModuleIds,
  focusedNodeId,
  graph,
  onFocusNode
}: InteractiveRepoGraphProps) {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('coreRings')
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [dragStart, setDragStart] = useState<null | { pointerX: number, pointerY: number, startX: number, startY: number }>(null)

  const hiddenNodeIds = useMemo(() => {
    const collapsed = new Set(collapsedModuleIds)
    const ids = new Set<string>()
    for (const node of graph.nodes) {
      const moduleId = node.metadata?.moduleId
      if (!moduleId || !collapsed.has(moduleId)) {
        continue
      }

      if ((node.type === 'file' || node.type === 'symbol') && node.id !== focusedNodeId) {
        ids.add(node.id)
      }
    }
    return ids
  }, [collapsedModuleIds, focusedNodeId, graph.nodes])

  const visibleNodes = useMemo(() => {
    return graph.nodes.filter(node => !hiddenNodeIds.has(node.id))
  }, [graph.nodes, hiddenNodeIds])

  const visibleNodeIdSet = useMemo(() => new Set(visibleNodes.map(node => node.id)), [visibleNodes])

  const visibleEdges = useMemo(() => {
    return graph.edges.filter(edge => visibleNodeIdSet.has(edge.source) && visibleNodeIdSet.has(edge.target))
  }, [graph.edges, visibleNodeIdSet])

  const positioned = useMemo(() => {
    if (layoutMode === 'coreRings') {
      return buildCoreRingsLayout(visibleNodes, visibleEdges)
    }
    return buildLayeredLayout(visibleNodes)
  }, [layoutMode, visibleEdges, visibleNodes])

  const focusedNeighborIds = useMemo(() => {
    if (!focusedNodeId) {
      return new Set<string>()
    }

    const neighbors = new Set<string>()
    for (const edge of visibleEdges) {
      if (edge.source === focusedNodeId) {
        neighbors.add(edge.target)
      }
      if (edge.target === focusedNodeId) {
        neighbors.add(edge.source)
      }
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
    if (!dragStart) {
      return
    }

    setViewport(prev => ({
      ...prev,
      x: dragStart.startX + (event.clientX - dragStart.pointerX),
      y: dragStart.startY + (event.clientY - dragStart.pointerY)
    }))
  }

  const handlePointerUp: PointerEventHandler<HTMLDivElement> = () => {
    setDragStart(null)
  }

  const getNodeEmphasis = (nodeId: string) => {
    if (!focusedNodeId) {
      return 'default'
    }

    if (nodeId === focusedNodeId) {
      return 'focused'
    }

    if (focusedNeighborIds.has(nodeId)) {
      return 'neighbor'
    }

    return 'dim'
  }

  const getEdgeEmphasis = (edge: RepoGraphEdge) => {
    if (!focusedNodeId) {
      return 'default'
    }

    if (edge.source === focusedNodeId || edge.target === focusedNodeId) {
      return 'focused'
    }

    if (focusedNeighborIds.has(edge.source) || focusedNeighborIds.has(edge.target)) {
      return 'neighbor'
    }

    return 'dim'
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          className="rounded-md border border-border px-2 py-1"
          onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * ZOOM_IN_FACTOR, MIN_SCALE, MAX_SCALE) }))}
          type="button"
        >
          Zoom in
        </button>
        <button
          className="rounded-md border border-border px-2 py-1"
          onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * ZOOM_OUT_FACTOR, MIN_SCALE, MAX_SCALE) }))}
          type="button"
        >
          Zoom out
        </button>
        <button
          className="rounded-md border border-border px-2 py-1"
          onClick={() => setViewport(DEFAULT_VIEWPORT)}
          type="button"
        >
          Reset view
        </button>
        <button
          className="rounded-md border border-border px-2 py-1"
          onClick={() => onFocusNode(null)}
          type="button"
        >
          Clear focus
        </button>
        <span className="text-muted-foreground">Layout:</span>
        <button
          aria-pressed={layoutMode === 'coreRings'}
          className={`rounded-md border px-2 py-1 ${
            layoutMode === 'coreRings'
              ? 'border-primary/60 bg-primary/10 text-primary'
              : 'border-border'
          }`}
          onClick={() => setLayoutMode('coreRings')}
          type="button"
        >
          Core Rings
        </button>
        <button
          aria-pressed={layoutMode === 'layered'}
          className={`rounded-md border px-2 py-1 ${
            layoutMode === 'layered'
              ? 'border-primary/60 bg-primary/10 text-primary'
              : 'border-border'
          }`}
          onClick={() => setLayoutMode('layered')}
          type="button"
        >
          Layered
        </button>
        <span className="text-muted-foreground">Nodes: {visibleNodes.length}</span>
        <span className="text-muted-foreground">Edges: {visibleEdges.length}</span>
      </div>

      <div
        className="relative h-[72vh] min-h-[580px] overflow-hidden rounded-md border border-border bg-muted/20"
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
            <marker id="arrow" markerHeight="6" markerWidth="6" orient="auto-start-reverse" refX="6" refY="3">
              <path d="M0,0 L6,3 L0,6 z" fill="#64748b" />
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
              const stroke = emphasis === 'focused'
                ? '#2563eb'
                : emphasis === 'neighbor'
                  ? '#0284c7'
                  : emphasis === 'dim'
                    ? '#94a3b833'
                    : '#64748b'

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
              const maxLabelLength = viewport.scale >= 3 ? 56 : viewport.scale >= 2 ? 40 : viewport.scale >= 1.3 ? 30 : 24
              const label = truncate(node.label, maxLabelLength)
              const nodeWidth = Math.max(94, Math.min(290, label.length * 6.6 + 30))

              return (
                <g
                  className="cursor-pointer"
                  key={node.id}
                  onClick={() => onFocusNode(node.id === focusedNodeId ? null : node.id)}
                  transform={`translate(${pos.x}, ${pos.y})`}
                >
                  <rect
                    fill={fill}
                    height={34}
                    rx={10}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    width={nodeWidth}
                    x={-nodeWidth / 2}
                    y={-17}
                  />
                  <text
                    className="fill-foreground text-[11px] font-medium"
                    textAnchor="middle"
                    x={0}
                    y={4}
                  >
                    {label}
                  </text>
                  <title>{`${node.label} (${node.type})`}</title>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
