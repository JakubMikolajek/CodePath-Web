export interface Graph {
  id: number
  fileName: string
  fileId: number
  graph: string
}

export type RepoGraphNodeType = 'repo' | 'module' | 'file' | 'symbol' | 'external_package'
export type RepoGraphEdgeType = 'imports' | 'calls' | 'depends_on' | 'owns' | 'produces' | 'consumes'

export interface RepoGraphNodeMetadata {
  fileId?: number
  filePath?: string
  moduleId?: string
}

export interface RepoGraphNode {
  id: string
  label: string
  type: RepoGraphNodeType
  metadata?: RepoGraphNodeMetadata
}

export interface RepoGraphEdge {
  id: string
  source: string
  target: string
  type: RepoGraphEdgeType
  metadata?: {
    label?: string
    rawType?: string
  }
}

export interface RepoInteractiveGraphFilters {
  depth?: number
  focusNodeId?: string
  includeSymbols?: boolean
  relationTypes?: RepoGraphEdgeType[]
}

export interface RepoInteractiveGraph {
  edges: RepoGraphEdge[]
  filters: RepoInteractiveGraphFilters
  generatedAt: string
  metadata: {
    availableEdgeTypes: RepoGraphEdgeType[]
    edgeCount: number
    includedSymbols?: boolean
    importResolution?: {
      ratio?: number
      resolved?: number
      total?: number
    }
    nodeCount: number
    repoId: number
    repoName: string
    topologyMode?: string
    truncated?: boolean
    truncationReason?: string
  }
  nodes: RepoGraphNode[]
}
