import { GenericNullable } from '@workspace/codepath-common/globals'
import { Repository } from '@workspace/codepath-common/repository'
import { create } from 'zustand'

import { createRepo } from '@/lib/repos/client'
import { CreateRepoFormData } from '@/utils/validators/createRepoForm'

interface Store {
  repos: Repository[]
  loading: boolean
  error: GenericNullable<string>
  clearError: () => void
  setRepos: (repos: Repository[]) => void
  createRepo: (repo: CreateRepoFormData) => Promise<void>
}

export const useReposStore = create<Store>((setState) => ({
  repos: [],
  loading: false,
  error: null,

  clearError: () => setState(() => ({ error: null })),

  setRepos: async (repos) => setState(() => ({ repos })),

  createRepo: async (repo) => {
    setState(() => ({ loading: true, error: null }))
    try {
      const newRepo = await createRepo(repo)
      setState((prevState) => ({
        repos: [...prevState.repos, newRepo],
        loading: false,
      }))
    } catch (error: any) {
      setState(() => ({
        loading: false,
        error: error.response?.data?.message || 'Cannot create repo',
      }))
    }
  },
}))
