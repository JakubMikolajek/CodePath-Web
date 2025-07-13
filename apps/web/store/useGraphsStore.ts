import { Graph } from '@workspace/codepath-common/graph'
import { create } from 'zustand'

import { getRepoDependencies } from '@/lib/dependencies'

interface Store {
  graphs: Graph[]
  getGraphs: (repoId: number) => Promise<void>
}

export const useGraphsStore = create<Store>((setState) => ({
  graphs: [],

  getGraphs: async (repoId) => {
    setState(() => ({ graphs: [] }))
    const deps = await getRepoDependencies(repoId)
    setState(() => ({ graphs: deps }))
  },
}))
