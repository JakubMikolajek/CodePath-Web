import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Nullable } from '@workspace/codepath-common/globals'
import type { Repository } from '@workspace/codepath-common/repository'

import { getApiErrorMessage } from '@/lib/api/error'
import { createRepo as createRepoApi, getRepos as getReposApi } from '@/lib/repos/client'
import { SliceName } from '@/redux/store'
import type { CreateRepoFormData } from '@/utils/validators/createRepoForm'

interface ReposState {
  error: Nullable<string>
  loading: boolean
  repos: Repository[]
  syncError: Nullable<string>
  syncErrorNonce: number
  syncing: boolean
}

const initialState: ReposState = {
  error: null,
  loading: false,
  repos: [],
  syncError: null,
  syncErrorNonce: 0,
  syncing: false
}

export const createRepo = createAsyncThunk('repos/createRepo',
  async (repo: CreateRepoFormData, { rejectWithValue }) => {
    try {
      return await createRepoApi(repo)
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, 'Cannot create repo'))
    }
  }
)

export const getRepos = createAsyncThunk('repos/getRepos',
  async (_, { rejectWithValue }) => {
    try {
      return await getReposApi()
    } catch (error: unknown) {
      return rejectWithValue(getApiErrorMessage(error, 'Cannot fetch repositories'))
    }
  }
)

const reposSlice = createSlice({
  initialState,
  name: SliceName.REPOS,
  extraReducers: builder => {
    builder.addCase(createRepo.pending, state => {
      state.loading = true
      state.error = null
    }).addCase(createRepo.fulfilled, (state, action) => {
      state.loading = false
      state.repos.push(action.payload)
    }).addCase(createRepo.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
    }).addCase(getRepos.pending, state => {
      state.syncing = true
    }).addCase(getRepos.fulfilled, (state, action) => {
      state.syncing = false
      state.repos = action.payload
      state.error = null
      state.syncError = null
    }).addCase(getRepos.rejected, (state, action) => {
      state.syncing = false
      state.syncError = action.payload as string
      state.syncErrorNonce += 1
    })
  },
  reducers: {
    dismissSyncError: state => {
      state.syncError = null
    },
    setRepos: (state, action: PayloadAction<Repository[]>) => {
      state.repos = action.payload
    }
  }
})

export const { dismissSyncError, setRepos } = reposSlice.actions
export default reposSlice.reducer
