import type { DependencyType } from '@workspace/codepath-common/globals'

export interface DepEdge {
  from: string
  importedFrom?: string
  to: string
  type: DependencyType
}
