import { create } from 'zustand'

import { GenericNullable } from '@/interfaces/globals'
import { Repo } from '@/interfaces/repo'
import { getRepos } from '@/lib/repos'

interface Store {
  repos: Repo[]
  loading: boolean
  error: GenericNullable<string>
  clearError: () => void
  getRepos: () => Promise<void>
}

export const useReposStore = create<Store>((setState) => ({
  repos: [],
  loading: false,
  error: null,

  clearError: () => setState(() => ({ error: null })),

  getRepos: async () => {
    setState(() => ({ loading: true, error: null }))
    try {
      const repos = await getRepos()
      setState(() => ({ repos, loading: true }))
    } catch (error: any) {
      setState(() => ({
        loading: false,
        error: error.response?.data?.message || 'Cannot fetch repos',
      }))
    }
  },
}))
