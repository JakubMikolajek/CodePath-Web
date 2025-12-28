import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { Graph } from '@workspace/codepath-common/graph'

import { getRepoGraphs } from '@/lib/graphs'

interface GraphsState {
  graphs: Graph[]
  loading: boolean
}

const initialState: GraphsState = {
  graphs: [],
  loading: false
}

export const getGraphs = createAsyncThunk('graphs/getGraphs',
  async (repoId: number) => {
    return await getRepoGraphs(repoId)
  }
)

const graphsSlice = createSlice({
  initialState,
  name: 'graphs',
  reducers: {},
  extraReducers: builder => {
    builder.addCase(getGraphs.pending, state => {
      state.graphs = []
      state.loading = true
    }).addCase(getGraphs.fulfilled, (state, action) => {
      state.graphs = action.payload
      state.loading = false
    }).addCase(getGraphs.rejected, state => {
      state.loading = false
    })
  }
})

export default graphsSlice.reducer
