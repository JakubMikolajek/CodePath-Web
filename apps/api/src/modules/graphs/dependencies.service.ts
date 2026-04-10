import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import type {
  RepoGraphEdge,
  RepoGraphEdgeType,
  RepoGraphNode,
  RepoInteractiveGraph
} from '@workspace/codepath-common/graph'
import { and, desc, eq } from 'drizzle-orm'
import { posix as pathPosix } from 'node:path'

import { env } from '../../config/env'
import { DbService } from '../db/db.service'
import {
  RepoTopologyDetector,
  type RepoTopologyFileInput,
  type RepoTopologyMode
} from './repo-topology.detector'
import { dependencies, repos } from '../db/schema'
import { QdrantService } from '../qdrant/qdrant.service'

interface InteractiveGraphQuery {
  depth?: string
  focusNodeId?: string
  includeSymbols?: string
  relationTypes?: string
}

interface RepoOwnership {
  id: number
  name: string
}

interface IngestSegmentPayload {
  content?: string
  file_ext?: string
  file_path?: string
  language?: string
  message_type?: string
  symbol_name?: string
}

interface CanonicalFile {
  content: string
  fileExt: string
  filePath: string
  language: string
  segmentCount: number
  symbolNames: Set<string>
}

interface CanonicalGraphBuildResult {
  edges: RepoGraphEdge[]
  importResolutionCoverage: {
    ratio: number
    resolved: number
    total: number
  }
  nodes: RepoGraphNode[]
  topologyMode: RepoTopologyMode
}

const SUPPORTED_RELATION_TYPES: RepoGraphEdgeType[] = [
  'imports',
  'calls',
  'depends_on',
  'owns',
  'produces',
  'consumes'
]

const MAX_CONTENT_PER_FILE = 220_000
const MAX_SEGMENTS_PER_FILE = 400
const MAX_SYMBOLS_PER_FILE = 300
const MAX_CALL_EDGES_PER_FILE = 120
const MAX_EVENT_EDGES_PER_FILE = 40
const MAX_RETURN_NODES = 1_600
const MAX_RETURN_EDGES = 3_800

const IGNORED_CALL_IDENTIFIERS = new Set([
  'and',
  'as',
  'assert',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'def',
  'default',
  'delete',
  'do',
  'elif',
  'else',
  'enum',
  'except',
  'export',
  'extends',
  'finally',
  'fn',
  'for',
  'from',
  'function',
  'if',
  'impl',
  'import',
  'in',
  'interface',
  'is',
  'lambda',
  'let',
  'loop',
  'match',
  'new',
  'or',
  'package',
  'pub',
  'raise',
  'return',
  'self',
  'static',
  'struct',
  'super',
  'switch',
  'throw',
  'trait',
  'try',
  'type',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield'
])

@Injectable()
export class DependenciesService {
  private logger: Logger = new Logger(DependenciesService.name)
  private readonly topologyDetector = new RepoTopologyDetector()

  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService
  ) { }

  async getRepoDependencies(userId: number, repoId: number) {
    await this.assertRepoOwnership(userId, repoId)

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
    const repo = await this.assertRepoOwnership(userId, repoId)
    const includeSymbols = this.parseIncludeSymbols(query.includeSymbols)
    const canonicalGraph = await this.buildCanonicalGraphFromQdrant(repo, { includeSymbols })
    const requestedRelationTypes = this.parseRelationTypes(query.relationTypes)
    const focusNodeId = query.focusNodeId?.trim() || undefined
    const depth = this.parseDepth(query.depth)

    let filteredEdges = canonicalGraph.edges
    if (requestedRelationTypes.length > 0) {
      filteredEdges = filteredEdges.filter(edge => requestedRelationTypes.includes(edge.type))
    }

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

      if (focusNodeId && canonicalGraph.nodes.some(node => node.id === focusNodeId)) {
        referencedNodeIds.add(focusNodeId)
      }

      scopedNodeIds = referencedNodeIds
    }

    const filteredNodes = canonicalGraph.nodes.filter(node => scopedNodeIds.has(node.id))
    const limitedGraph = this.applyGraphScaleLimits(filteredNodes, filteredEdges)
    const availableEdgeTypes = this.availableEdgeTypes(limitedGraph.edges)
    const importResolutionCoverage = canonicalGraph.importResolutionCoverage.total > 0
      ? canonicalGraph.importResolutionCoverage.ratio
      : 1

    this.logger.log(
      `Interactive graph built from qdrant for repo=${repoId}, nodes=${limitedGraph.nodes.length}, edges=${limitedGraph.edges.length}, includeSymbols=${includeSymbols}, topologyMode=${canonicalGraph.topologyMode}, importResolutionCoverage=${importResolutionCoverage.toFixed(3)}, truncated=${limitedGraph.truncated}`
    )

    const metadata: RepoInteractiveGraph['metadata'] = {
      availableEdgeTypes,
      edgeCount: limitedGraph.edges.length,
      includedSymbols: includeSymbols,
      importResolution: {
        ratio: canonicalGraph.importResolutionCoverage.ratio,
        resolved: canonicalGraph.importResolutionCoverage.resolved,
        total: canonicalGraph.importResolutionCoverage.total
      },
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

  private async buildCanonicalGraphFromQdrant(
    repo: RepoOwnership,
    options: { includeSymbols: boolean }
  ): Promise<CanonicalGraphBuildResult> {
    const segments = await this.fetchRepoSegmentsFromQdrant(repo.id)
    const repoNodeId = `repo:${repo.id}`
    const nodesById = new Map<string, RepoGraphNode>([
      [
        repoNodeId,
        {
          id: repoNodeId,
          label: repo.name,
          type: 'repo'
        }
      ]
    ])
    const edgesByKey = new Map<string, RepoGraphEdge>()

    if (segments.length === 0) {
      return {
        edges: [...edgesByKey.values()],
        importResolutionCoverage: {
          ratio: 1,
          resolved: 0,
          total: 0
        },
        nodes: [...nodesById.values()],
        topologyMode: 'path'
      }
    }

    const files = this.buildCanonicalFiles(segments)
    const topologyInput = new Map<string, RepoTopologyFileInput>()
    for (const [filePath, file] of files.entries()) {
      topologyInput.set(filePath, {
        content: file.content,
        fileExt: file.fileExt,
        filePath: file.filePath,
        language: file.language
      })
    }

    const topology = this.topologyDetector.detect(topologyInput)
    const knownFilePaths = new Set(files.keys())
    const moduleNodeIdByFilePath = new Map<string, string>()
    const internalImportsByFilePath = new Map<string, Set<string>>()
    const externalImportsByFilePath = new Map<string, Set<string>>()
    const symbolRefsByNormalizedName = new Map<string, Array<{ filePath: string, symbolNodeId: string }>>()

    for (const file of files.values()) {
      const moduleNodeId = topology.moduleIdByFilePath.get(file.filePath) ?? this.toModuleNodeId(repo.id, this.fallbackModuleLabel(file.filePath))
      const moduleLabel = topology.moduleLabelByFilePath.get(file.filePath) ?? this.fallbackModuleLabel(file.filePath)
      const fileNodeId = this.toFileNodeId(file.filePath)
      moduleNodeIdByFilePath.set(file.filePath, moduleNodeId)

      this.addNode(nodesById, {
        id: moduleNodeId,
        label: moduleLabel,
        type: 'module'
      })

      this.addNode(nodesById, {
        id: fileNodeId,
        label: file.filePath,
        metadata: {
          filePath: file.filePath,
          moduleId: moduleNodeId
        },
        type: 'file'
      })

      this.addEdge(edgesByKey, {
        id: `${repoNodeId}->${moduleNodeId}:owns`,
        source: repoNodeId,
        target: moduleNodeId,
        type: 'owns'
      })

      this.addEdge(edgesByKey, {
        id: `${moduleNodeId}->${fileNodeId}:owns`,
        source: moduleNodeId,
        target: fileNodeId,
        type: 'owns'
      })

      if (options.includeSymbols) {
        for (const symbolName of file.symbolNames) {
          const symbolNodeId = this.toSymbolNodeId(file.filePath, symbolName)
          const normalizedSymbolName = this.normalizeSymbolName(symbolName)
          this.addNode(nodesById, {
            id: symbolNodeId,
            label: symbolName,
            metadata: {
              filePath: file.filePath,
              moduleId: moduleNodeId
            },
            type: 'symbol'
          })

          this.addEdge(edgesByKey, {
            id: `${fileNodeId}->${symbolNodeId}:owns`,
            source: fileNodeId,
            target: symbolNodeId,
            type: 'owns'
          })

          if (!symbolRefsByNormalizedName.has(normalizedSymbolName)) {
            symbolRefsByNormalizedName.set(normalizedSymbolName, [])
          }
          symbolRefsByNormalizedName.get(normalizedSymbolName)?.push({
            filePath: file.filePath,
            symbolNodeId
          })
        }
      }

      const imports = this.extractImportSpecifiers(file.content, file.language, file.fileExt)

      for (const specifier of imports) {
        const resolution = topology.resolveImport(file.filePath, specifier, knownFilePaths)
        const sourceNodeId = fileNodeId

        if (resolution.resolvedPath) {
          if (!internalImportsByFilePath.has(file.filePath)) {
            internalImportsByFilePath.set(file.filePath, new Set())
          }
          internalImportsByFilePath.get(file.filePath)?.add(resolution.resolvedPath)

          const targetNodeId = this.toFileNodeId(resolution.resolvedPath)
          this.addEdge(edgesByKey, {
            id: `${sourceNodeId}->${targetNodeId}:imports`,
            metadata: {
              label: specifier,
              rawType: 'import'
            },
            source: sourceNodeId,
            target: targetNodeId,
            type: 'imports'
          })

          continue
        }

        if (!externalImportsByFilePath.has(file.filePath)) {
          externalImportsByFilePath.set(file.filePath, new Set())
        }
        externalImportsByFilePath.get(file.filePath)?.add(specifier)

        const externalNodeId = this.toExternalNodeId(specifier)
        this.addNode(nodesById, {
          id: externalNodeId,
          label: specifier,
          type: 'external_package'
        })
        this.addEdge(edgesByKey, {
          id: `${sourceNodeId}->${externalNodeId}:imports`,
          metadata: {
            label: specifier,
            rawType: 'import'
          },
          source: sourceNodeId,
          target: externalNodeId,
          type: 'imports'
        })
      }
    }

    for (const file of files.values()) {
      const sourceFileNodeId = this.toFileNodeId(file.filePath)
      const sourceModuleNodeId = moduleNodeIdByFilePath.get(file.filePath)
      if (!sourceModuleNodeId) {
        continue
      }

      const internalImports = internalImportsByFilePath.get(file.filePath) ?? new Set<string>()
      const externalImports = externalImportsByFilePath.get(file.filePath) ?? new Set<string>()

      for (const targetFilePath of internalImports) {
        const targetModuleNodeId = moduleNodeIdByFilePath.get(targetFilePath)
        if (!targetModuleNodeId || targetModuleNodeId === sourceModuleNodeId) {
          continue
        }

        this.addEdge(edgesByKey, {
          id: `${sourceModuleNodeId}->${targetModuleNodeId}:depends_on`,
          metadata: {
            label: `${file.filePath} -> ${targetFilePath}`,
            rawType: 'module_dependency'
          },
          source: sourceModuleNodeId,
          target: targetModuleNodeId,
          type: 'depends_on'
        })
      }

      for (const externalSpecifier of externalImports) {
        this.addEdge(edgesByKey, {
          id: `${sourceModuleNodeId}->${this.toExternalNodeId(externalSpecifier)}:depends_on`,
          metadata: {
            label: externalSpecifier,
            rawType: 'external_dependency'
          },
          source: sourceModuleNodeId,
          target: this.toExternalNodeId(externalSpecifier),
          type: 'depends_on'
        })
      }

      if (options.includeSymbols) {
        const callCandidates = this.extractCallIdentifiers(file.content, file.language, file.fileExt)
        let callEdgesAdded = 0
        for (const callIdentifier of callCandidates) {
          if (callEdgesAdded >= MAX_CALL_EDGES_PER_FILE) {
            break
          }

          const normalizedCallIdentifier = this.normalizeSymbolName(callIdentifier)
          const symbolRefs = symbolRefsByNormalizedName.get(normalizedCallIdentifier)
          if (!symbolRefs || symbolRefs.length === 0) {
            continue
          }

          const matchingRef = symbolRefs.find(symbolRef => {
            if (symbolRef.filePath === file.filePath) {
              return false
            }

            if (internalImports.has(symbolRef.filePath)) {
              return true
            }

            const sourceModuleId = moduleNodeIdByFilePath.get(file.filePath)
            const targetModuleId = moduleNodeIdByFilePath.get(symbolRef.filePath)
            return sourceModuleId && targetModuleId && sourceModuleId === targetModuleId
          })

          if (!matchingRef) {
            continue
          }

          this.addEdge(edgesByKey, {
            id: `${sourceFileNodeId}->${matchingRef.symbolNodeId}:calls`,
            metadata: {
              label: callIdentifier,
              rawType: 'symbol_call'
            },
            source: sourceFileNodeId,
            target: matchingRef.symbolNodeId,
            type: 'calls'
          })
          callEdgesAdded += 1
        }
      }

      const producedEvents = this.extractEventNames(file.content, 'produces')
      let producedEdgesAdded = 0
      for (const eventName of producedEvents) {
        if (producedEdgesAdded >= MAX_EVENT_EDGES_PER_FILE) {
          break
        }

        const eventNodeId = this.toEventNodeId(eventName)
        this.addNode(nodesById, {
          id: eventNodeId,
          label: `event:${eventName}`,
          type: 'external_package'
        })

        this.addEdge(edgesByKey, {
          id: `${sourceFileNodeId}->${eventNodeId}:produces`,
          metadata: {
            label: eventName,
            rawType: 'event'
          },
          source: sourceFileNodeId,
          target: eventNodeId,
          type: 'produces'
        })

        producedEdgesAdded += 1
      }

      const consumedEvents = this.extractEventNames(file.content, 'consumes')
      let consumedEdgesAdded = 0
      for (const eventName of consumedEvents) {
        if (consumedEdgesAdded >= MAX_EVENT_EDGES_PER_FILE) {
          break
        }

        const eventNodeId = this.toEventNodeId(eventName)
        this.addNode(nodesById, {
          id: eventNodeId,
          label: `event:${eventName}`,
          type: 'external_package'
        })

        this.addEdge(edgesByKey, {
          id: `${sourceFileNodeId}->${eventNodeId}:consumes`,
          metadata: {
            label: eventName,
            rawType: 'event'
          },
          source: sourceFileNodeId,
          target: eventNodeId,
          type: 'consumes'
        })

        consumedEdgesAdded += 1
      }
    }

    const resolutionStats = topology.getResolutionStats()
    const resolutionRatio = resolutionStats.total > 0
      ? resolutionStats.resolved / resolutionStats.total
      : 1

    return {
      edges: [...edgesByKey.values()],
      importResolutionCoverage: {
        ratio: resolutionRatio,
        resolved: resolutionStats.resolved,
        total: resolutionStats.total
      },
      nodes: [...nodesById.values()],
      topologyMode: topology.topologyMode
    }
  }

  private addEdge(edgesByKey: Map<string, RepoGraphEdge>, edge: RepoGraphEdge) {
    const key = `${edge.source}|${edge.type}|${edge.target}`
    if (edgesByKey.has(key)) {
      return
    }

    edgesByKey.set(key, edge)
  }

  private addNode(nodesById: Map<string, RepoGraphNode>, node: RepoGraphNode) {
    if (nodesById.has(node.id)) {
      return
    }

    nodesById.set(node.id, node)
  }

  private availableEdgeTypes(edges: RepoGraphEdge[]) {
    const available = new Set<RepoGraphEdgeType>()
    for (const edge of edges) {
      available.add(edge.type)
    }

    return SUPPORTED_RELATION_TYPES.filter(type => available.has(type))
  }

  private buildCanonicalFiles(segments: IngestSegmentPayload[]) {
    const files = new Map<string, CanonicalFile>()

    for (const segment of segments) {
      const normalizedPath = this.normalizeFilePath(segment.file_path)
      if (!normalizedPath) {
        continue
      }

      const existing = files.get(normalizedPath) ?? {
        content: '',
        fileExt: this.safeString(segment.file_ext) ?? pathPosix.extname(normalizedPath),
        filePath: normalizedPath,
        language: this.safeString(segment.language) ?? 'unknown',
        segmentCount: 0,
        symbolNames: new Set<string>()
      }

      const content = this.safeString(segment.content)
      if (
        content
        && existing.segmentCount < MAX_SEGMENTS_PER_FILE
        && existing.content.length < MAX_CONTENT_PER_FILE
      ) {
        const remaining = MAX_CONTENT_PER_FILE - existing.content.length
        if (remaining > 0) {
          const nextChunk = content.slice(0, remaining)
          existing.content = existing.content.length > 0
            ? `${existing.content}\n${nextChunk}`
            : nextChunk
        }
      }
      existing.segmentCount += 1

      const symbolName = this.safeString(segment.symbol_name)
      const baseName = pathPosix.basename(normalizedPath)
      if (
        symbolName
        && symbolName !== baseName
        && existing.symbolNames.size < MAX_SYMBOLS_PER_FILE
      ) {
        existing.symbolNames.add(symbolName)
      }

      files.set(normalizedPath, existing)
    }

    return files
  }

  private collectNodeIdsWithinDepth(focusNodeId: string, edges: RepoGraphEdge[], depth: number) {
    const adjacency = new Map<string, Set<string>>()

    for (const edge of edges) {
      if (!adjacency.has(edge.source)) {
        adjacency.set(edge.source, new Set())
      }
      if (!adjacency.has(edge.target)) {
        adjacency.set(edge.target, new Set())
      }

      adjacency.get(edge.source)?.add(edge.target)
      adjacency.get(edge.target)?.add(edge.source)
    }

    const visited = new Set<string>([focusNodeId])
    const queue: Array<{ nodeId: string, remaining: number }> = [{ nodeId: focusNodeId, remaining: depth }]

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        break
      }

      if (current.remaining <= 0) {
        continue
      }

      for (const adjacentNodeId of adjacency.get(current.nodeId) ?? []) {
        if (visited.has(adjacentNodeId)) {
          continue
        }

        visited.add(adjacentNodeId)
        queue.push({ nodeId: adjacentNodeId, remaining: current.remaining - 1 })
      }
    }

    return visited
  }

  private extractImportSpecifiers(content: string, language: string, fileExt: string) {
    const importSpecifiers = new Set<string>()
    if (!content.trim()) {
      return importSpecifiers
    }

    const addSpecifier = (specifier: null | string) => {
      if (!specifier) {
        return
      }

      const trimmed = specifier.trim()
      if (!trimmed || trimmed.length > 256) {
        return
      }

      importSpecifiers.add(trimmed)
    }

    const applyPattern = (pattern: RegExp, pickIndex = 1) => {
      for (const match of content.matchAll(pattern)) {
        addSpecifier(match[pickIndex] ?? null)
      }
    }

    applyPattern(/^\s*import\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/gm)
    applyPattern(/^\s*import\s+['"]([^'"]+)['"]/gm)
    applyPattern(/^\s*export\s+[^'"]*?\s+from\s+['"]([^'"]+)['"]/gm)
    applyPattern(/\brequire\(\s*['"]([^'"]+)['"]\s*\)/g)
    applyPattern(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)
    applyPattern(/^\s*from\s+([A-Za-z0-9_.]+)\s+import\s+/gm)
    applyPattern(/^\s*use\s+([A-Za-z0-9_:]+)\s*;/gm)
    applyPattern(/^\s*import\s+([A-Za-z0-9_.*]+)\s*;/gm)
    applyPattern(/^\s*import\s*(?:\(\s*)?["'`]([^"'`]+)["'`]/gm)

    if (language === 'python' || fileExt === '.py') {
      for (const match of content.matchAll(/^\s*import\s+([A-Za-z0-9_.,\s]+)/gm)) {
        const modules = (match[1] ?? '').split(',')
          .map(moduleName => moduleName.trim().split(/\s+as\s+/i)[0]?.trim())
          .filter(Boolean)
        for (const moduleName of modules) {
          addSpecifier(moduleName ?? null)
        }
      }
    }

    return importSpecifiers
  }

  private extractCallIdentifiers(content: string, language: string, fileExt: string) {
    const identifiers = new Set<string>()
    if (!content.trim()) {
      return identifiers
    }

    const addIdentifier = (value: null | string) => {
      if (!value) {
        return
      }

      const normalized = value.trim()
      if (!normalized || normalized.length < 2 || normalized.length > 120) {
        return
      }

      if (IGNORED_CALL_IDENTIFIERS.has(normalized.toLowerCase())) {
        return
      }

      identifiers.add(normalized)
    }

    for (const match of content.matchAll(/\b([A-Za-z_][A-Za-z0-9_$]{1,119})\s*\(/g)) {
      addIdentifier(match[1] ?? null)
    }

    if (language === 'python' || fileExt === '.py') {
      for (const match of content.matchAll(/\.\s*([A-Za-z_][A-Za-z0-9_]{1,119})\s*\(/g)) {
        addIdentifier(match[1] ?? null)
      }
    }

    return identifiers
  }

  private extractEventNames(content: string, edgeType: 'consumes' | 'produces') {
    const names = new Set<string>()
    if (!content.trim()) {
      return names
    }

    const addEventName = (rawValue: null | string) => {
      if (!rawValue) {
        return
      }

      const normalized = rawValue.trim()
      if (!normalized || normalized.length < 2 || normalized.length > 120) {
        return
      }

      if (!/^[a-zA-Z0-9_.:/-]+$/.test(normalized)) {
        return
      }

      names.add(normalized)
    }

    const producerPatterns = [
      /\b(?:publish|emit|dispatch|enqueue|produce|send)\s*\(\s*['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g,
      /\b(?:publish|emit|dispatch|enqueue|produce|send)\s+['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g,
      /\b(?:basic_publish|send_to_queue)\s*\(\s*['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g
    ]

    const consumerPatterns = [
      /\b(?:on|subscribe|consume|listen|handle)\s*\(\s*['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g,
      /\b(?:on|subscribe|consume|listen|handle)\s+['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g,
      /\b(?:basic_consume|assertQueue)\s*\(\s*['"`]([a-zA-Z0-9_.:/-]{2,120})['"`]/g
    ]

    const patterns = edgeType === 'produces' ? producerPatterns : consumerPatterns
    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        addEventName(match[1] ?? null)
      }
    }

    return names
  }

  private async fetchRepoSegmentsFromQdrant(repoId: number): Promise<IngestSegmentPayload[]> {
    const payloads: IngestSegmentPayload[] = []
    let offset: number | string | undefined = undefined
    const collectionName = env.qdrantEmbeddingsCollectionName

    try {
      while (true) {
        const result = await this.qdrantService.scroll(collectionName, {
          filter: {
            must: [
              {
                key: 'repo_id',
                match: {
                  value: repoId
                }
              }
            ]
          },
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
          if (!point?.payload || typeof point.payload !== 'object') {
            continue
          }

          const payload = point.payload as IngestSegmentPayload
          if (
            typeof payload.message_type === 'string'
            && payload.message_type !== 'ingest.batch.ready'
          ) {
            continue
          }

          const filePath = this.normalizeFilePath(payload.file_path)
          if (!filePath) {
            continue
          }

          payloads.push({
            ...payload,
            file_path: filePath
          })
        }

        if (result?.next_page_offset === undefined || result?.next_page_offset === null) {
          break
        }

        if (typeof result.next_page_offset === 'number' || typeof result.next_page_offset === 'string') {
          offset = result.next_page_offset
        } else {
          break
        }
      }
    } catch (error) {
      const safeError = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to load repo segments from Qdrant for repo=${repoId}: ${safeError}`)
      return []
    }

    return payloads
  }

  private normalizeFilePath(filePath: unknown) {
    if (typeof filePath !== 'string') {
      return null
    }

    const normalized = filePath
      .trim()
      .replaceAll('\\', '/')
      .replace(/^\.\/+/, '')
      .replace(/\/{2,}/g, '/')

    if (!normalized) {
      return null
    }

    return normalized
  }

  private parseDepth(depth?: string) {
    const parsedDepth = Number(depth)
    if (!Number.isFinite(parsedDepth)) {
      return 2
    }

    return Math.min(5, Math.max(1, Math.trunc(parsedDepth)))
  }

  private parseIncludeSymbols(includeSymbols?: string) {
    if (includeSymbols === undefined) {
      return true
    }

    const normalized = includeSymbols.trim().toLowerCase()
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
      return false
    }

    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
      return true
    }

    return true
  }

  private parseRelationTypes(relationTypes?: string) {
    if (!relationTypes) {
      return [] as RepoGraphEdgeType[]
    }

    const requestedTypes = relationTypes
      .split(',')
      .map(type => type.trim().toLowerCase() as RepoGraphEdgeType)
      .filter(type => SUPPORTED_RELATION_TYPES.includes(type))

    return Array.from(new Set(requestedTypes))
  }

  private applyGraphScaleLimits(nodes: RepoGraphNode[], edges: RepoGraphEdge[]) {
    let truncated = false
    let truncationReason: string | undefined = undefined
    let limitedNodes = nodes
    let limitedEdges = edges

    if (limitedNodes.length > MAX_RETURN_NODES) {
      truncated = true
      truncationReason = 'node_cap'
      const typePriority: Record<RepoGraphNode['type'], number> = {
        repo: 0,
        module: 1,
        file: 2,
        external_package: 3,
        symbol: 4
      }

      const sortedNodes = [...limitedNodes].sort((a, b) => {
        const byType = typePriority[a.type] - typePriority[b.type]
        if (byType !== 0) {
          return byType
        }
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
        depends_on: 0,
        imports: 1,
        owns: 2,
        calls: 3,
        produces: 4,
        consumes: 5
      }

      const sortedEdges = [...limitedEdges].sort((a, b) => {
        const byType = edgePriority[a.type] - edgePriority[b.type]
        if (byType !== 0) {
          return byType
        }
        return a.id.localeCompare(b.id)
      })

      limitedEdges = sortedEdges.slice(0, MAX_RETURN_EDGES)
      const referencedNodeIds = new Set<string>()
      for (const edge of limitedEdges) {
        referencedNodeIds.add(edge.source)
        referencedNodeIds.add(edge.target)
      }

      limitedNodes = limitedNodes.filter(node => node.type === 'repo' || referencedNodeIds.has(node.id))
    }

    return {
      edges: limitedEdges,
      nodes: limitedNodes,
      truncated,
      truncationReason
    }
  }

  private normalizeSymbolName(symbolName: string) {
    return symbolName.trim().toLowerCase()
  }

  private safeString(value: unknown) {
    if (typeof value !== 'string') {
      return null
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private toExternalNodeId(specifier: string) {
    return `external:${specifier}`
  }

  private toEventNodeId(eventName: string) {
    return `external:event:${eventName.toLowerCase()}`
  }

  private fallbackModuleLabel(filePath: string) {
    const directory = pathPosix.dirname(filePath)
    return directory === '.' ? 'root' : directory
  }

  private toFileNodeId(filePath: string) {
    return `file:${filePath}`
  }

  private toModuleNodeId(repoId: number, moduleLabel: string) {
    return `module:${repoId}:${moduleLabel}`
  }

  private toSymbolNodeId(filePath: string, symbolName: string) {
    return `symbol:${filePath}:${symbolName}`
  }

  private async assertRepoOwnership(userId: number, repoId: number): Promise<RepoOwnership> {
    const [repo] = await this.dbService.dbClient.select({
      id: repos.id,
      name: repos.name
    })
      .from(repos)
      .where(and(eq(repos.id, repoId), eq(repos.userId, userId)))
      .limit(1)

    if (!repo) {
      throw new NotFoundException('Repository not found')
    }

    return repo
  }
}
