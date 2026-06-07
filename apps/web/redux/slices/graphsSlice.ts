import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { Nullable } from '@workspace/codepath-common/globals'
import type { Graph, RepoGraphEdgeType, RepoInteractiveGraph } from '@workspace/codepath-common/graph'

import { getRepoGraphs, getRepoInteractiveGraph } from '@/lib/graphs'
import { SliceName } from '@/redux/sliceName'

interface GraphsState {
  graphs: Graph[]
  interactiveGraph: Nullable<RepoInteractiveGraph>
  loading: boolean
  loadingInteractive: boolean
}

const initialState: GraphsState = {
  graphs: [],
  interactiveGraph: null,
  loading: false,
  loadingInteractive: false
}

export const getGraphs = createAsyncThunk('graphs/getGraphs', async (repoId: number) => await getRepoGraphs(repoId))

export const getInteractiveGraph = createAsyncThunk('graphs/getInteractiveGraph',
  async (payload: {
    depth?: number
    focusNodeId?: string
    includeSymbols?: boolean
    relationTypes?: RepoGraphEdgeType[]
    repoId: number
  }) => await getRepoInteractiveGraph(payload.repoId, {
    depth: payload.depth,
    focusNodeId: payload.focusNodeId,
    includeSymbols: payload.includeSymbols,
    relationTypes: payload.relationTypes
  })
)

const graphsSlice = createSlice({
  initialState,
  name: SliceName.GRAPHS,
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
    }).addCase(getInteractiveGraph.pending, state => {
      state.loadingInteractive = true
      state.interactiveGraph = null
    }).addCase(getInteractiveGraph.fulfilled, (state, action) => {
      state.loadingInteractive = false
      state.interactiveGraph = action.payload
    }).addCase(getInteractiveGraph.rejected, state => {
      state.loadingInteractive = false
    })
  }
})

export default graphsSlice.reducer
