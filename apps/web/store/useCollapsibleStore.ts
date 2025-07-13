import { GenericNullable } from '@workspace/codepath-common/globals'
import { create } from 'zustand'


interface Store {
  openRepoId: GenericNullable<number>
  setOpenRepoId: (id: GenericNullable<number>) => void
  isRepoOpen: (id: number) => boolean
  toggleRepo: (id: number) => void
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
