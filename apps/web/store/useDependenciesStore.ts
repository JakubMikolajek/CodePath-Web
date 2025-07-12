import { create } from 'zustand'

import { DependencyEdge } from '@/interfaces/dependencies'
import { getRepoDependencies } from '@/lib/dependencies'

interface Store {
  graphs: DependencyEdge[]
  getGraphs: (repoId: number) => Promise<void>
}

export const useDependenciesStore = create<Store>((setState) => ({
  graphs: [],

  getGraphs: async (repoId) => {
    setState(() => ({ graphs: [] }))
    const deps = await getRepoDependencies(repoId)
    setState(() => ({ graphs: deps }))
  },
}))
