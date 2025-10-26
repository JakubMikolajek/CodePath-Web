import type { GenericNullable } from '@workspace/codepath-common/globals'
import { create } from 'zustand'

interface Store {
  isRepoOpen: (id: number) => boolean
  openRepoId: GenericNullable<number>
  setOpenRepoId: (id: GenericNullable<number>) => void
  toggleRepo: (id: number) => void
}

export const useCollapsibleStore = create<Store>((set, get) => ({
  openRepoId: null,

  isRepoOpen: id => get().openRepoId === id,

  setOpenRepoId: id => set({ openRepoId: id }),

  toggleRepo: id => {
    const { openRepoId } = get()
    set({ openRepoId: openRepoId === id ? null : id })
  }
}))
