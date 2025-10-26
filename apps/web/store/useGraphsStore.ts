import type { Graph } from '@workspace/codepath-common/graph'
import { create } from 'zustand'

import { getRepoGraphs } from '@/lib/graphs'

interface Store {
  getGraphs: (repoId: number) => Promise<void>
  graphs: Graph[]
}

export const useGraphsStore = create<Store>(setState => ({
  graphs: [],

  getGraphs: async repoId => {
    setState(() => ({ graphs: [] }))
    const deps = await getRepoGraphs(repoId)
    setState(() => ({ graphs: deps }))
  }
}))
