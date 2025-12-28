import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { GenericNullable } from '@workspace/codepath-common/globals'

interface CollapsibleState {
  openRepoId: GenericNullable<number>
}

const initialState: CollapsibleState = {
  openRepoId: null
}

const collapsibleSlice = createSlice({
  initialState,
  name: 'collapsible',
  reducers: {
    setOpenRepoId: (state, action: PayloadAction<GenericNullable<number>>) => {
      state.openRepoId = action.payload
    },
    toggleRepo: (state, action: PayloadAction<number>) => {
      const id = action.payload
      state.openRepoId = state.openRepoId === id ? null : id
    }
  }
})

export const { setOpenRepoId, toggleRepo } = collapsibleSlice.actions
export default collapsibleSlice.reducer
