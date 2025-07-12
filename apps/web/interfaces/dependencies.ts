import { GenericNullable } from '@/interfaces/globals'

export interface DependencyEdge {
  from: string
  to: string
  type: string
  fileId: number
  importedFrom: GenericNullable<string>
}
