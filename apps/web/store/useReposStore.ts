import { GenericNullable } from '@workspace/codepath-common/globals'
import { Repository } from '@workspace/codepath-common/repository'
import { create } from 'zustand'

import { createRepo, getRepos } from '@/lib/repos'
import { CreateRepoFormData } from '@/utils/validators/createRepoForm'

interface Store {
  repos: Repository[]
  loading: boolean
  error: GenericNullable<string>
  clearError: () => void
  getRepos: () => Promise<void>
  createRepo: (repo: CreateRepoFormData) => Promise<void>
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
      setState(() => ({ repos, loading: false }))
    } catch (error: any) {
      setState(() => ({
        loading: false,
        error: error.response?.data?.message || 'Cannot fetch repos',
      }))
    }
  },

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
