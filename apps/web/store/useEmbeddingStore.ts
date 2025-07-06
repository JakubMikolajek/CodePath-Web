import { create } from 'zustand'

import { GenericNullable } from '@/interfaces/globals'
import { runEmbedding, shouldBeEmbedded } from '@/lib/embedding'

interface Store {
  loading: boolean
  error: GenericNullable<string>
  status: GenericNullable<string>
  clearError: () => void
  runEmbedding: (repoId: number) => Promise<void>
  shouldBeEmbedded: (repoId: number) => Promise<boolean>
}

export const useEmbeddingStore = create<Store>((setState) => ({
  status: null,
  loading: false,
  error: null,

  clearError: () => setState(() => ({ error: null })),

  runEmbedding: async (repoId) => {
    setState(() => ({ loading: true, error: null }))
    try {
      const { message } = await runEmbedding(repoId)
      setState(() => ({ status: message, loading: false }))
    } catch (error: any) {
      setState(() => ({
        loading: false,
        error: error.response?.data?.message || 'Cannot run embedding',
      }))
    }
  },

  shouldBeEmbedded: async (repoId) => {
    return await shouldBeEmbedded(repoId)
  },
}))
