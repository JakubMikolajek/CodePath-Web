import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Nullable } from '@workspace/codepath-common/globals'

interface CollapsibleState {
  openRepoId: Nullable<number>
}

const initialState: CollapsibleState = {
  openRepoId: null
}

const collapsibleSlice = createSlice({
  initialState,
  name: 'collapsible',
  reducers: {
    setOpenRepoId: (state, action: PayloadAction<Nullable<number>>) => {
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
