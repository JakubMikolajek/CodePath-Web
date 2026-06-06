import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Nullable } from '@workspace/codepath-common/globals'

import { SliceName } from '@/redux/store'

interface CollapsibleState {
  openRepoId: Nullable<number>
}

const initialState: CollapsibleState = {
  openRepoId: null
}

const collapsibleSlice = createSlice({
  initialState,
  name: SliceName.COLLAPSIBLE,
  reducers: {
    setOpenRepoId: (state, action: PayloadAction<Nullable<number>>) => {
      state.openRepoId = action.payload
    }
  }
})

export const { setOpenRepoId } = collapsibleSlice.actions
export default collapsibleSlice.reducer
