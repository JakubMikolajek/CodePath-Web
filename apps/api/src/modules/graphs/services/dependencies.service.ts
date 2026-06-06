import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { Nullable, Undefinable } from '@workspace/codepath-common'
import type {
  RepoGraphEdge,
  RepoGraphNode,
  RepoInteractiveGraph
} from '@workspace/codepath-common/graph'
import {
  RepoGraphEdgeType,
  RepoGraphNodeType
} from '@workspace/codepath-common/graph'
import { desc, eq } from 'drizzle-orm'

import { env } from '../../../config/env'
import { assertRepoOwnership } from '../../../utils/helpers'
import { dependencies } from '../../db/schema'
import { DbService } from '../../db/services/db.service'
import { QdrantService } from '../../qdrant/services/qdrant.service'
import {
  DependencyGraphBuilder,
  type IngestSegmentPayload
} from '../builders/dependency-graph.builder'

interface InteractiveGraphQuery {
  depth?: string
  focusNodeId?: string
  includeSymbols?: string
  relationTypes?: string
}

const SUPPORTED_RELATION_TYPES: RepoGraphEdgeType[] = [
  RepoGraphEdgeType.IMPORTS,
  RepoGraphEdgeType.CALLS,
  RepoGraphEdgeType.DEPENDS_ON,
  RepoGraphEdgeType.OWNS,
  RepoGraphEdgeType.PRODUCES,
  RepoGraphEdgeType.CONSUMES
]

const MAX_RETURN_NODES = 1_600
const MAX_RETURN_EDGES = 3_800

@Injectable()
export class DependenciesService {
  private readonly graphBuilder = new DependencyGraphBuilder()
  private logger: Logger = new Logger(DependenciesService.name)

  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService
  ) { }

  async getRepoDependencies(userId: number, repoId: number) {
    await assertRepoOwnership(this.dbService, userId, repoId)

    const allDependencies = await this.dbService.dbClient.select()
      .from(dependencies)
      .where(eq(dependencies.repoId, repoId))
      .orderBy(desc(dependencies.createdAt))

    return allDependencies.map(dependency => ({
      fileId: dependency.fileId,
      fileName: dependency.fileName,
      graph: dependency.graph,
      id: dependency.id
    }))
  }

  async getRepoInteractiveGraph(userId: number, repoId: number, query: InteractiveGraphQuery): Promise<RepoInteractiveGraph> {
    const repo = await assertRepoOwnership(this.dbService, userId, repoId)
    const includeSymbols = this.parseIncludeSymbols(query.includeSymbols)
    const segments = await this.fetchRepoSegmentsFromQdrant(repo.id)
    const canonicalGraph = this.graphBuilder.build(repo, segments, { includeSymbols })
    const requestedRelationTypes = this.parseRelationTypes(query.relationTypes)
    const focusNodeId = query.focusNodeId?.trim() || undefined
    const depth = this.parseDepth(query.depth)

    let filteredEdges = canonicalGraph.edges

    if (requestedRelationTypes.length > 0) filteredEdges = filteredEdges.filter(edge => requestedRelationTypes.includes(edge.type))

    let scopedNodeIds = new Set(canonicalGraph.nodes.map(node => node.id))
    const repoNodeId = `repo:${repo.id}`

    if (focusNodeId && scopedNodeIds.has(focusNodeId)) {
      scopedNodeIds = this.collectNodeIdsWithinDepth(focusNodeId, filteredEdges, depth)
      scopedNodeIds.add(repoNodeId)
      filteredEdges = filteredEdges.filter(edge => scopedNodeIds.has(edge.source) && scopedNodeIds.has(edge.target))
    }

    if (requestedRelationTypes.length > 0 || (focusNodeId && scopedNodeIds.has(focusNodeId))) {
      const referencedNodeIds = new Set<string>([repoNodeId])

      for (const edge of filteredEdges) {
        referencedNodeIds.add(edge.source)
        referencedNodeIds.add(edge.target)
      }

      if (focusNodeId && canonicalGraph.nodes.some(node => node.id === focusNodeId)) referencedNodeIds.add(focusNodeId)

      scopedNodeIds = referencedNodeIds
    }

    const filteredNodes = canonicalGraph.nodes.filter(node => scopedNodeIds.has(node.id))
    const limitedGraph = this.applyGraphScaleLimits(filteredNodes, filteredEdges)
    const availableEdgeTypes = this.availableEdgeTypes(limitedGraph.edges)
    const importResolutionCoverage = canonicalGraph.importResolutionCoverage.total > 0 ? canonicalGraph.importResolutionCoverage.ratio : 1

    this.logger.log(`Interactive graph built from qdrant for repo=${repoId}, nodes=${limitedGraph.nodes.length}, edges=${limitedGraph.edges.length}, includeSymbols=${includeSymbols}, topologyMode=${canonicalGraph.topologyMode}, importResolutionCoverage=${importResolutionCoverage.toFixed(3)}, truncated=${limitedGraph.truncated}`)

    const metadata: RepoInteractiveGraph['metadata'] = {
      availableEdgeTypes,
      edgeCount: limitedGraph.edges.length,
      importResolution: {
        ratio: canonicalGraph.importResolutionCoverage.ratio,
        resolved: canonicalGraph.importResolutionCoverage.resolved,
        total: canonicalGraph.importResolutionCoverage.total
      },
      includedSymbols: includeSymbols,
      nodeCount: limitedGraph.nodes.length,
      repoId: repo.id,
      repoName: repo.name,
      topologyMode: canonicalGraph.topologyMode,
      truncated: limitedGraph.truncated,
      truncationReason: limitedGraph.truncationReason
    }

    return {
      edges: limitedGraph.edges,
      filters: {
        depth: focusNodeId ? depth : undefined,
        focusNodeId,
        includeSymbols,
        relationTypes: requestedRelationTypes.length > 0 ? requestedRelationTypes : undefined
      },
      generatedAt: new Date().toISOString(),
      metadata,
      nodes: limitedGraph.nodes
    }
  }

  private applyGraphScaleLimits(nodes: RepoGraphNode[], edges: RepoGraphEdge[]) {
    let truncated = false
    let truncationReason: Undefinable<string> = undefined
    let limitedNodes = nodes
    let limitedEdges = edges

    if (limitedNodes.length > MAX_RETURN_NODES) {
      truncated = true
      truncationReason = 'node_cap'
      const typePriority: Record<RepoGraphNode['type'], number> = {
        [RepoGraphNodeType.EXTERNAL_PACKAGE]: 3,
        [RepoGraphNodeType.FILE]: 2,
        [RepoGraphNodeType.MODULE]: 1,
        [RepoGraphNodeType.REPO]: 0,
        [RepoGraphNodeType.SYMBOL]: 4
      }

      const sortedNodes = [...limitedNodes].sort((a, b) => {
        const byType = typePriority[a.type] - typePriority[b.type]

        if (byType !== 0) return byType

        return a.label.localeCompare(b.label)
      })

      limitedNodes = sortedNodes.slice(0, MAX_RETURN_NODES)
      const keptNodeIds = new Set(limitedNodes.map(node => node.id))
      limitedEdges = limitedEdges.filter(edge => keptNodeIds.has(edge.source) && keptNodeIds.has(edge.target))
    }

    if (limitedEdges.length > MAX_RETURN_EDGES) {
      truncated = true
      truncationReason = truncationReason ? `${truncationReason}+edge_cap` : 'edge_cap'
      const edgePriority: Record<RepoGraphEdgeType, number> = {
        [RepoGraphEdgeType.CALLS]: 3,
        [RepoGraphEdgeType.CONSUMES]: 5,
        [RepoGraphEdgeType.DEPENDS_ON]: 0,
        [RepoGraphEdgeType.IMPORTS]: 1,
        [RepoGraphEdgeType.OWNS]: 2,
        [RepoGraphEdgeType.PRODUCES]: 4
      }

      const sortedEdges = [...limitedEdges].sort((a, b) => {
        const byType = edgePriority[a.type] - edgePriority[b.type]

        if (byType !== 0) return byType

        return a.id.localeCompare(b.id)
      })

      limitedEdges = sortedEdges.slice(0, MAX_RETURN_EDGES)
      const referencedNodeIds = new Set<string>()

      for (const edge of limitedEdges) {
        referencedNodeIds.add(edge.source)
        referencedNodeIds.add(edge.target)
      }

      limitedNodes = limitedNodes.filter(node => node.type === RepoGraphNodeType.REPO || referencedNodeIds.has(node.id))
    }

    return { edges: limitedEdges, nodes: limitedNodes, truncated, truncationReason }
  }

  private assertRelationType(value: string): Nullable<RepoGraphEdgeType> {
    const normalized = value.trim().toLowerCase()
    return SUPPORTED_RELATION_TYPES.find(type => type === normalized) ?? null
  }

  private availableEdgeTypes(edges: RepoGraphEdge[]): RepoGraphEdgeType[] {
    const available = new Set<RepoGraphEdgeType>()

    for (const edge of edges) {
      available.add(edge.type)
    }

    return SUPPORTED_RELATION_TYPES.filter(type => available.has(type))
  }

  private collectNodeIdsWithinDepth(focusNodeId: string, edges: RepoGraphEdge[], depth: number): Set<string> {
    const adjacency = new Map<string, Set<string>>()

    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set())
      if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set())

      adjacency.get(edge.source)?.add(edge.target)
      adjacency.get(edge.target)?.add(edge.source)
    }

    const visited = new Set<string>([focusNodeId])
    const queue: Array<{ nodeId: string, remaining: number }> = [{ nodeId: focusNodeId, remaining: depth }]

    while (queue.length > 0) {
      const current = queue.shift()

      if (!current) break
      if (current.remaining <= 0) continue

      for (const adjacentNodeId of adjacency.get(current.nodeId) ?? []) {
        if (visited.has(adjacentNodeId)) continue

        visited.add(adjacentNodeId)
        queue.push({ nodeId: adjacentNodeId, remaining: current.remaining - 1 })
      }
    }

    return visited
  }

  private async fetchRepoSegmentsFromQdrant(repoId: number): Promise<IngestSegmentPayload[]> {
    const payloads: IngestSegmentPayload[] = []
    let offset: Undefinable<number | string> = undefined
    const collectionName = env.qdrantEmbeddingsCollectionName

    try {
      while (true) {
        const result = await this.qdrantService.scroll(collectionName, {
          filter: { must: [{ key: 'repo_id', match: { value: repoId } }] },
          limit: 256,
          offset,
          withPayload: true,
          withVector: false
        }) as {
          next_page_offset?: unknown
          points?: Array<{ payload?: Record<string, unknown> }>
        }

        const points = Array.isArray(result?.points) ? result.points : []

        for (const point of points) {
          if (!point?.payload || typeof point.payload !== 'object') continue

          const payload = point.payload as IngestSegmentPayload

          if (typeof payload.message_type === 'string' && payload.message_type !== 'ingest.batch.ready') continue

          const filePath = this.normalizeFilePath(payload.file_path)

          if (!filePath) continue

          payloads.push({ ...payload, file_path: filePath })
        }

        if (result?.next_page_offset === undefined || result?.next_page_offset === null) break

        if (typeof result.next_page_offset === 'number' || typeof result.next_page_offset === 'string') offset = result.next_page_offset
        else break
      }
    } catch (error) {
      const safeError = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to load repo segments from Qdrant for repo=${repoId}: ${safeError}`)
      throw new ServiceUnavailableException('Repository graph is unavailable because Qdrant cannot be reached')
    }

    return payloads
  }

  private normalizeFilePath(filePath: unknown): Nullable<string> {
    if (typeof filePath !== 'string') return null

    const normalized = filePath.trim()
      .replaceAll('\\', '/')
      .replace(/^\.\/+/, '')
      .replace(/\/{2,}/g, '/')

    return normalized.length > 0 ? normalized : null
  }

  private parseDepth(depth?: string): number {
    const parsedDepth = Number(depth)

    if (!Number.isFinite(parsedDepth)) return 2

    return Math.min(5, Math.max(1, Math.trunc(parsedDepth)))
  }

  private parseIncludeSymbols(includeSymbols?: string): boolean {
    if (includeSymbols === undefined) return true

    const normalized = includeSymbols.trim().toLowerCase()

    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true

    return true
  }

  private parseRelationTypes(relationTypes?: string): RepoGraphEdgeType[] {
    if (!relationTypes) return [] as RepoGraphEdgeType[]

    const requestedTypes = relationTypes
      .split(',')
      .map(type => this.assertRelationType(type))
      .filter((type): type is RepoGraphEdgeType => type !== null)
      .filter(type => SUPPORTED_RELATION_TYPES.includes(type))

    return Array.from(new Set(requestedTypes))
  }
}
