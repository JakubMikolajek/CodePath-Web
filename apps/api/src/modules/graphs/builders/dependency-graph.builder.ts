import { posix as pathPosix } from 'node:path'

import type {
  RepoGraphEdge,
  RepoGraphNode
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

  build(
    repo: RepoOwnership,
    segments: IngestSegmentPayload[],
    options: { includeSymbols: boolean }
  ): CanonicalGraphBuildResult {
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

      const imports = this.codeExtractor.extractImportSpecifiers(file.content, file.language, file.fileExt)

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

        if (this.noiseFilter.isNodeModuleSpecifier(specifier, file.language, file.fileExt)) {
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
        const callCandidates = this.codeExtractor.extractCallIdentifiers(file.content, file.language, file.fileExt)
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

      const producedEvents = this.codeExtractor.extractEventNames(file.content, 'produces')
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

      const consumedEvents = this.codeExtractor.extractEventNames(file.content, 'consumes')
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

  private fallbackModuleLabel(filePath: string) {
    const directory = pathPosix.dirname(filePath)
    return directory === '.' ? 'root' : directory
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

    if (this.noiseFilter.isNodeModulesFilePath(normalized)) {
      return null
    }

    return normalized
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

  private toEventNodeId(eventName: string) {
    return `external:event:${eventName.toLowerCase()}`
  }

  private toExternalNodeId(specifier: string) {
    return `external:${specifier}`
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
}
