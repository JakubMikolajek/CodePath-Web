import { create } from 'zustand'

import { DependencyEdge } from '@/interfaces/dependencies'
import { getRepoDependencies } from '@/lib/dependencies'

type FileGraph = {
  fileId: number
  graph: string
}

interface Store {
  dependencies: DependencyEdge[]
  getDependencies: (repoId: number) => Promise<void>
  graphs: FileGraph[]
}

export function toMermaidPerFile(deps: DependencyEdge[]): FileGraph[] {
  const grouped = new Map<number, DependencyEdge[]>()

  for (const dep of deps) {
    if (!grouped.has(dep.fileId)) {
      grouped.set(dep.fileId, [])
    }
    grouped.get(dep.fileId)!.push(dep)
  }

  const result: FileGraph[] = []

  for (const [fileId, edges] of grouped.entries()) {
    result.push({
      fileId,
      graph: toMermaid(edges),
    })
  }

  return result
}

function toMermaid(deps: DependencyEdge[]): string {
  const lines = ['flowchart TD']
  for (const { from, to, type, importedFrom } of deps) {
    const safeFrom = sanitize(from)
    const safeTo = sanitize(to)
    const safeType = sanitize(type)

    const labelParts = [safeType]
    if (importedFrom) {
      labelParts.push(`from ${importedFrom}`)
    }

    const label = labelParts.join(' ')

    lines.push(
      `  ${safeFrom}["${from}"] -->|${label}| ${safeTo}["${to}"]`,
    )
  }
  return lines.join('\n')
}

function sanitize(id: string): string {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
}


export const useDependenciesStore = create<Store>((setState) => ({
  dependencies: [],
  graphs: [],

  getDependencies: async (repoId) => {
    setState(() => ({ dependencies: [] }))
    const deps = await getRepoDependencies(repoId)
    setState(() => ({ dependencies: deps, graphs: toMermaidPerFile(deps) }))
  },
}))
