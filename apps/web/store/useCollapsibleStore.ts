import { create } from 'zustand'

import { GenericNullable } from '@/interfaces/globals'

interface Store {
  openRepoId: GenericNullable<string>
  setOpenRepoId: (id: GenericNullable<string>) => void
  isRepoOpen: (id: string) => boolean
  toggleRepo: (id: string) => void
}

export const useCollapsibleStore = create<Store>((set, get) => ({
  openRepoId: null,
  setOpenRepoId: (id) => set({ openRepoId: id }),
  isRepoOpen: (id) => get().openRepoId === id,
  toggleRepo: (id) => {
    const { openRepoId } = get()
    set({ openRepoId: openRepoId === id ? null : id })
  },
}))
