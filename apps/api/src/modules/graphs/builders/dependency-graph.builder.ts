import { posix as pathPosix } from 'node:path'

import type { Nullable, Undefinable } from '@workspace/codepath-common'
import type {
  RepoGraphEdge,
  RepoGraphNode
} from '@workspace/codepath-common/graph'
import {
  RepoGraphEdgeType,
  RepoGraphNodeType
} from '@workspace/codepath-common/graph'

import { DependencyCodeExtractor } from '../extractors/dependency-code.extractor'
import { GraphNoiseFilter } from '../filters/graph-noise.filter'
import {
  RepoTopologyDetector,
  type RepoTopologyFileInput,
  type RepoTopologyMode
} from '../topology/repo-topology.detector'

export interface RepoOwnership {
  id: number
  name: string
}

export interface IngestSegmentPayload {
  ast_path?: string[]
  category?: string
  content?: string
  end_line?: number
  file_ext?: string
  file_path?: string
  http_method?: string
  import_specifiers?: string[]
  language?: string
  message_type?: string
  node_type?: string
  parent_symbol_name?: string
  parse_strategy?: string
  route_path?: string
  segment_id?: string
  start_line?: number
  symbol_kind?: string
  symbol_name?: string
}

interface CanonicalSymbol {
  astPath?: string[]
  endLine?: number
  httpMethod?: string
  id: string
  label: string
  nodeType?: string
  parentSymbolName?: string
  parseStrategy?: string
  routePath?: string
  startLine?: number
  symbolKind: string
}

interface CanonicalFile {
  content: string
  fileExt: string
  filePath: string
  importSpecifiers: Set<string>
  language: string
  segmentCount: number
  symbolKeys: Set<string>
  symbols: CanonicalSymbol[]
}

export interface CanonicalGraphBuildResult {
  edges: RepoGraphEdge[]
  importResolutionCoverage: {
    ratio: number
    resolved: number
    total: number
  }
  nodes: RepoGraphNode[]
  topologyMode: RepoTopologyMode
}

const MAX_CONTENT_PER_FILE = 220_000
const MAX_SEGMENTS_PER_FILE = 400
const MAX_SYMBOLS_PER_FILE = 300
const MAX_CALL_EDGES_PER_FILE = 120
const MAX_EVENT_EDGES_PER_FILE = 40

export class DependencyGraphBuilder {
  private readonly codeExtractor = new DependencyCodeExtractor()
  private readonly noiseFilter = new GraphNoiseFilter()
  private readonly topologyDetector = new RepoTopologyDetector()

  build(repo: RepoOwnership, segments: IngestSegmentPayload[], options: { includeSymbols: boolean }): CanonicalGraphBuildResult {
    const repoNodeId = `repo:${repo.id}`
    const nodesById = new Map<string, RepoGraphNode>([
      [repoNodeId, {
        id: repoNodeId,
        label: repo.name,
        type: RepoGraphNodeType.REPO
      }]
    ])

    const edgesByKey = new Map<string, RepoGraphEdge>()

    if (segments.length === 0) {
      return {
        edges: [...edgesByKey.values()],
        importResolutionCoverage: { ratio: 1, resolved: 0, total: 0 },
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
        type: RepoGraphNodeType.MODULE
      })

      this.addNode(nodesById, {
        id: fileNodeId,
        label: file.filePath,
        metadata: { filePath: file.filePath, moduleId: moduleNodeId },
        type: RepoGraphNodeType.FILE
      })

      this.addEdge(edgesByKey, {
        id: `${repoNodeId}->${moduleNodeId}:owns`,
        source: repoNodeId,
        target: moduleNodeId,
        type: RepoGraphEdgeType.OWNS
      })

      this.addEdge(edgesByKey, {
        id: `${moduleNodeId}->${fileNodeId}:owns`,
        source: moduleNodeId,
        target: fileNodeId,
        type: RepoGraphEdgeType.OWNS
      })

      if (options.includeSymbols) {
        for (const symbol of file.symbols) {
          const symbolNodeId = this.toSymbolNodeId(file.filePath, symbol)
          const normalizedSymbolName = this.normalizeSymbolName(symbol.label)

          this.addNode(nodesById, {
            id: symbolNodeId,
            label: symbol.label,
            metadata: {
              astPath: symbol.astPath,
              endLine: symbol.endLine,
              filePath: file.filePath,
              httpMethod: symbol.httpMethod,
              moduleId: moduleNodeId,
              nodeType: symbol.nodeType,
              parentSymbolName: symbol.parentSymbolName,
              parseStrategy: symbol.parseStrategy,
              routePath: symbol.routePath,
              startLine: symbol.startLine,
              symbolKind: symbol.symbolKind
            },
            type: RepoGraphNodeType.SYMBOL
          })

          this.addEdge(edgesByKey, {
            id: `${fileNodeId}->${symbolNodeId}:owns`,
            source: fileNodeId,
            target: symbolNodeId,
            type: RepoGraphEdgeType.OWNS
          })

          if (!symbolRefsByNormalizedName.has(normalizedSymbolName)) symbolRefsByNormalizedName.set(normalizedSymbolName, [])

          symbolRefsByNormalizedName.get(normalizedSymbolName)?.push({ filePath: file.filePath, symbolNodeId })

          if (symbol.routePath) {
            const endpointLabel = this.toEndpointLabel(symbol.httpMethod, symbol.routePath)
            const endpointNodeId = this.toEndpointNodeId(symbol.httpMethod, symbol.routePath)
            this.addNode(nodesById, {
              id: endpointNodeId,
              label: endpointLabel,
              metadata: {
                filePath: file.filePath,
                httpMethod: symbol.httpMethod,
                moduleId: moduleNodeId,
                routePath: symbol.routePath
              },
              type: RepoGraphNodeType.EXTERNAL_PACKAGE
            })

            this.addEdge(edgesByKey, {
              id: `${symbolNodeId}->${endpointNodeId}:produces`,
              metadata: {
                label: endpointLabel,
                rawType: 'http_endpoint'
              },
              source: symbolNodeId,
              target: endpointNodeId,
              type: RepoGraphEdgeType.PRODUCES
            })
          }
        }
      }

      const imports = file.importSpecifiers.size > 0
        ? file.importSpecifiers
        : this.codeExtractor.extractImportSpecifiers(file.content, file.language, file.fileExt)

      for (const specifier of imports) {
        const resolution = topology.resolveImport(file.filePath, specifier, knownFilePaths)
        const sourceNodeId = fileNodeId

        if (resolution.resolvedPath) {
          if (!internalImportsByFilePath.has(file.filePath)) internalImportsByFilePath.set(file.filePath, new Set())

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
            type: RepoGraphEdgeType.IMPORTS
          })

          continue
        }

        if (this.noiseFilter.isNodeModuleSpecifier(specifier, file.language, file.fileExt)) continue

        if (!externalImportsByFilePath.has(file.filePath)) externalImportsByFilePath.set(file.filePath, new Set())

        externalImportsByFilePath.get(file.filePath)?.add(specifier)

        const externalNodeId = this.toExternalNodeId(specifier)

        this.addNode(nodesById, {
          id: externalNodeId,
          label: specifier,
          type: RepoGraphNodeType.EXTERNAL_PACKAGE
        })

        this.addEdge(edgesByKey, {
          id: `${sourceNodeId}->${externalNodeId}:imports`,
          metadata: {
            label: specifier,
            rawType: 'import'
          },
          source: sourceNodeId,
          target: externalNodeId,
          type: RepoGraphEdgeType.IMPORTS
        })
      }
    }

    for (const file of files.values()) {
      const sourceFileNodeId = this.toFileNodeId(file.filePath)
      const sourceModuleNodeId = moduleNodeIdByFilePath.get(file.filePath)

      if (!sourceModuleNodeId) continue

      const internalImports = internalImportsByFilePath.get(file.filePath) ?? new Set<string>()
      const externalImports = externalImportsByFilePath.get(file.filePath) ?? new Set<string>()

      for (const targetFilePath of internalImports) {
        const targetModuleNodeId = moduleNodeIdByFilePath.get(targetFilePath)

        if (!targetModuleNodeId || targetModuleNodeId === sourceModuleNodeId) continue

        this.addEdge(edgesByKey, {
          id: `${sourceModuleNodeId}->${targetModuleNodeId}:depends_on`,
          metadata: { label: `${file.filePath} -> ${targetFilePath}`, rawType: 'module_dependency' },
          source: sourceModuleNodeId,
          target: targetModuleNodeId,
          type: RepoGraphEdgeType.DEPENDS_ON
        })
      }

      for (const externalSpecifier of externalImports) {
        this.addEdge(edgesByKey, {
          id: `${sourceModuleNodeId}->${this.toExternalNodeId(externalSpecifier)}:depends_on`,
          metadata: { label: externalSpecifier, rawType: 'external_dependency' },
          source: sourceModuleNodeId,
          target: this.toExternalNodeId(externalSpecifier),
          type: RepoGraphEdgeType.DEPENDS_ON
        })
      }

      if (options.includeSymbols) {
        // TODO(ingest.v2): replace this best-effort source fallback once Ingest emits call/reference metadata.
        const callCandidates = this.codeExtractor.extractCallIdentifiers(file.content, file.language, file.fileExt)
        let callEdgesAdded = 0

        for (const callIdentifier of callCandidates) {
          if (callEdgesAdded >= MAX_CALL_EDGES_PER_FILE) break

          const normalizedCallIdentifier = this.normalizeSymbolName(callIdentifier)
          const symbolRefs = symbolRefsByNormalizedName.get(normalizedCallIdentifier)

          if (!symbolRefs || symbolRefs.length === 0) continue

          const matchingRef = symbolRefs.find(symbolRef => {
            if (symbolRef.filePath === file.filePath) return false
            if (internalImports.has(symbolRef.filePath)) return true

            const sourceModuleId = moduleNodeIdByFilePath.get(file.filePath)
            const targetModuleId = moduleNodeIdByFilePath.get(symbolRef.filePath)

            return sourceModuleId && targetModuleId && sourceModuleId === targetModuleId
          })

          if (!matchingRef) continue

          this.addEdge(edgesByKey, {
            id: `${sourceFileNodeId}->${matchingRef.symbolNodeId}:calls`,
            metadata: { label: callIdentifier, rawType: 'symbol_call' },
            source: sourceFileNodeId,
            target: matchingRef.symbolNodeId,
            type: RepoGraphEdgeType.CALLS
          })
          callEdgesAdded += 1
        }
      }

      // TODO(ingest.v2): replace event regexes once event metadata is emitted by Ingest.
      const producedEvents = this.codeExtractor.extractEventNames(file.content, 'produces')
      let producedEdgesAdded = 0

      for (const eventName of producedEvents) {
        if (producedEdgesAdded >= MAX_EVENT_EDGES_PER_FILE) break

        const eventNodeId = this.toEventNodeId(eventName)

        this.addNode(nodesById, {
          id: eventNodeId,
          label: `event:${eventName}`,
          type: RepoGraphNodeType.EXTERNAL_PACKAGE
        })

        this.addEdge(edgesByKey, {
          id: `${sourceFileNodeId}->${eventNodeId}:produces`,
          metadata: {
            label: eventName,
            rawType: 'event'
          },
          source: sourceFileNodeId,
          target: eventNodeId,
          type: RepoGraphEdgeType.PRODUCES
        })

        producedEdgesAdded += 1
      }

      const consumedEvents = this.codeExtractor.extractEventNames(file.content, 'consumes')
      let consumedEdgesAdded = 0

      for (const eventName of consumedEvents) {
        if (consumedEdgesAdded >= MAX_EVENT_EDGES_PER_FILE) break

        const eventNodeId = this.toEventNodeId(eventName)

        this.addNode(nodesById, {
          id: eventNodeId,
          label: `event:${eventName}`,
          type: RepoGraphNodeType.EXTERNAL_PACKAGE
        })

        this.addEdge(edgesByKey, {
          id: `${sourceFileNodeId}->${eventNodeId}:consumes`,
          metadata: {
            label: eventName,
            rawType: 'event'
          },
          source: sourceFileNodeId,
          target: eventNodeId,
          type: RepoGraphEdgeType.CONSUMES
        })

        consumedEdgesAdded += 1
      }
    }

    const resolutionStats = topology.getResolutionStats()
    const resolutionRatio = resolutionStats.total > 0 ? resolutionStats.resolved / resolutionStats.total : 1

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

  private addEdge(edgesByKey: Map<string, RepoGraphEdge>, edge: RepoGraphEdge): void {
    const key = `${edge.source}|${edge.type}|${edge.target}`

    if (edgesByKey.has(key)) return

    edgesByKey.set(key, edge)
  }

  private addNode(nodesById: Map<string, RepoGraphNode>, node: RepoGraphNode): void {
    if (nodesById.has(node.id)) return

    nodesById.set(node.id, node)
  }

  private buildCanonicalFiles(segments: IngestSegmentPayload[]): Map<string, CanonicalFile> {
    const files = new Map<string, CanonicalFile>()

    for (const segment of segments) {
      const normalizedPath = this.normalizeFilePath(segment.file_path)

      if (!normalizedPath) continue

      const existing = files.get(normalizedPath) ?? {
        content: '',
        fileExt: this.safeString(segment.file_ext) ?? pathPosix.extname(normalizedPath),
        filePath: normalizedPath,
        importSpecifiers: new Set<string>(),
        language: this.safeString(segment.language) ?? 'unknown',
        segmentCount: 0,
        symbolKeys: new Set<string>(),
        symbols: []
      }

      const content = this.safeString(segment.content)

      if (content && existing.segmentCount < MAX_SEGMENTS_PER_FILE && existing.content.length < MAX_CONTENT_PER_FILE) {
        const remaining = MAX_CONTENT_PER_FILE - existing.content.length

        if (remaining > 0) {
          const nextChunk = content.slice(0, remaining)
          existing.content = existing.content.length > 0 ? `${existing.content}\n${nextChunk}` : nextChunk
        }
      }

      existing.segmentCount += 1

      for (const importSpecifier of this.normalizeStringArray(segment.import_specifiers)) {
        existing.importSpecifiers.add(importSpecifier)
      }

      const symbol = this.toCanonicalSymbol(normalizedPath, segment)

      if (symbol && existing.symbols.length < MAX_SYMBOLS_PER_FILE && !existing.symbolKeys.has(symbol.id)) {
        existing.symbols.push(symbol)
        existing.symbolKeys.add(symbol.id)
      }

      files.set(normalizedPath, existing)
    }

    return files
  }

  private fallbackModuleLabel(filePath: string): string {
    const directory = pathPosix.dirname(filePath)
    return directory === '.' ? 'root' : directory
  }

  private normalizeAstPath(value: unknown): Undefinable<string[]> {
    if (!Array.isArray(value)) return undefined

    const astPath = value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)

    return astPath.length > 0 ? astPath : undefined
  }

  private normalizeFilePath(filePath: unknown): Nullable<string> {
    if (typeof filePath !== 'string') return null

    const normalized = filePath.trim()
      .replaceAll('\\', '/')
      .replace(/^\.\/+/, '')
      .replace(/\/{2,}/g, '/')

    if (!normalized) return null
    if (this.noiseFilter.isNodeModulesFilePath(normalized)) return null

    return normalized
  }

  private normalizeLine(value: unknown): Undefinable<number> {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined

    return Math.trunc(value)
  }

  private normalizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return []

    return value
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
  }

  private normalizeSymbolName(symbolName: string): string {
    return symbolName.trim().toLowerCase()
  }

  private safeString(value: unknown): Nullable<string> {
    if (typeof value !== 'string') return null

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  private toCanonicalSymbol(filePath: string, segment: IngestSegmentPayload): Nullable<CanonicalSymbol> {
    const label = this.safeString(segment.symbol_name)

    if (!label) return null

    const symbolKind = this.safeString(segment.symbol_kind) ?? 'symbol'
    const parseStrategy = this.safeString(segment.parse_strategy) ?? undefined
    const nodeType = this.safeString(segment.node_type) ?? undefined
    const routePath = this.safeString(segment.route_path) ?? undefined
    const httpMethod = this.safeString(segment.http_method)?.toUpperCase()
    const astPath = this.normalizeAstPath(segment.ast_path)
    const isAstSemanticSegment = parseStrategy === 'tree_sitter' || Boolean(nodeType || routePath || httpMethod || astPath)
    const nonSemanticKinds = new Set(['config', 'documentation', 'file'])

    if (!isAstSemanticSegment && nonSemanticKinds.has(symbolKind.toLowerCase())) return null
    if (!isAstSemanticSegment && label === pathPosix.basename(filePath)) return null

    const explicitId = this.safeString(segment.segment_id)
    const startLine = this.normalizeLine(segment.start_line)
    const endLine = this.normalizeLine(segment.end_line)
    const fallbackId = [
      filePath,
      symbolKind,
      label,
      startLine ?? '',
      endLine ?? ''
    ].join(':')

    return {
      astPath,
      endLine,
      httpMethod,
      id: explicitId ?? fallbackId,
      label,
      nodeType,
      parentSymbolName: this.safeString(segment.parent_symbol_name) ?? undefined,
      parseStrategy,
      routePath,
      startLine,
      symbolKind
    }
  }

  private toEndpointLabel(httpMethod: Undefinable<string>, routePath: string): string {
    return httpMethod ? `${httpMethod} ${routePath}` : routePath
  }

  private toEndpointNodeId(httpMethod: Undefinable<string>, routePath: string): string {
    return `external:http:${httpMethod ?? 'ANY'}:${routePath}`
  }

  private toEventNodeId(eventName: string): string {
    return `external:event:${eventName.toLowerCase()}`
  }

  private toExternalNodeId(specifier: string): string {
    return `external:${specifier}`
  }

  private toFileNodeId(filePath: string): string {
    return `file:${filePath}`
  }

  private toModuleNodeId(repoId: number, moduleLabel: string): string {
    return `module:${repoId}:${moduleLabel}`
  }

  private toSymbolNodeId(filePath: string, symbol: CanonicalSymbol): string {
    return `symbol:${filePath}:${symbol.id}`
  }
}
