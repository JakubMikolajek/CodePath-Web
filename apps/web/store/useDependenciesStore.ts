import { create } from 'zustand'

import { DependencyEdge } from '@/interfaces/dependencies'
import { getRepoDependencies } from '@/lib/dependencies'

interface Store {
  dependencies: DependencyEdge[]
  getDependencies: (repoId: number) => Promise<void>
  graph: string
}

function toMermaid(deps: DependencyEdge[]): string {
  const lines = ['flowchart TD']
  for (const { from, to, type } of deps) {
    const safeFrom = sanitize(from)
    const safeTo = sanitize(to)
    const safeType = sanitize(type)
    lines.push(`  ${safeFrom}["${from}"] -->|${safeType}| ${safeTo}["${to}"]`)
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
  graph: '',

  getDependencies: async (repoId) => {
    setState(() => ({ dependencies: [] }))
    const deps = await getRepoDependencies(repoId)
    setState(() => ({ dependencies: deps, graph: toMermaid(deps) }))
  },
}))
