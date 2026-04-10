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

export default function InteractiveRepoGraph({
  collapsedModuleIds,
  focusedNodeId,
  graph,
  onFocusNode
}: InteractiveRepoGraphProps) {
  const [viewport, setViewport] = useState({ scale: 1, x: 80, y: 56 })
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
    let maxRows = 1

    NODE_TYPE_ORDER.forEach((type, typeIndex) => {
      const nodes = grouped.get(type) ?? []
      maxRows = Math.max(maxRows, nodes.length)

      nodes.forEach((node, rowIndex) => {
        positions.set(node.id, {
          x: 120 + typeIndex * 270,
          y: 110 + rowIndex * 88
        })
      })
    })

    const width = Math.max(1320, NODE_TYPE_ORDER.length * 280 + 240)
    const height = Math.max(760, maxRows * 94 + 220)

    return {
      height,
      positions,
      width
    }
  }, [visibleNodes])

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

  const showEdgeLabels = visibleEdges.length <= 80

  const handleWheel: WheelEventHandler<HTMLDivElement> = event => {
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.12 : 0.88
    setViewport(prev => ({
      ...prev,
      scale: clamp(prev.scale * factor, 0.35, 2.6)
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
          onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * 1.12, 0.35, 2.6) }))}
          type="button"
        >
          Zoom in
        </button>
        <button
          className="rounded-md border border-border px-2 py-1"
          onClick={() => setViewport(prev => ({ ...prev, scale: clamp(prev.scale * 0.88, 0.35, 2.6) }))}
          type="button"
        >
          Zoom out
        </button>
        <button
          className="rounded-md border border-border px-2 py-1"
          onClick={() => setViewport({ scale: 1, x: 80, y: 56 })}
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

              return (
                <g
                  className="cursor-pointer"
                  key={node.id}
                  onClick={() => onFocusNode(node.id === focusedNodeId ? null : node.id)}
                  transform={`translate(${pos.x}, ${pos.y})`}
                >
                  <circle fill={fill} r={18} stroke={stroke} strokeWidth={strokeWidth} />
                  <text
                    className="fill-foreground text-[10px] font-medium"
                    textAnchor="middle"
                    x={0}
                    y={35}
                  >
                    {truncate(node.label, 24)}
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
