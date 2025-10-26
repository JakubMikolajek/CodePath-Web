import type { GenericNullable } from '@workspace/codepath-common/globals'
import type { Repository } from '@workspace/codepath-common/repository'
import { create } from 'zustand'

import { createRepo } from '@/lib/repos/client'
import type { CreateRepoFormData } from '@/utils/validators/createRepoForm'

interface Store {
  clearError: () => void
  createRepo: (repo: CreateRepoFormData) => Promise<void>
  error: GenericNullable<string>
  loading: boolean
  repos: Repository[]
  setRepos: (repos: Repository[]) => void
}

export const useReposStore = create<Store>(setState => ({
  error: null,
  loading: false,
  repos: [],

  clearError: () => setState(() => ({ error: null })),

  createRepo: async repo => {
    setState(() => ({ error: null, loading: true }))
    try {
      const newRepo = await createRepo(repo)
      setState(prevState => ({
        loading: false,
        repos: [...prevState.repos, newRepo]
      }))
    } catch (error: any) {
      setState(() => ({
        error: error.response?.data?.message ?? 'Cannot create repo',
        loading: false
      }))
    }
  },

  setRepos: repos => setState(() => ({ repos }))
}))
