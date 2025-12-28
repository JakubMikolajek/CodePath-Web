import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { GenericNullable } from '@workspace/codepath-common/globals'
import type { Repository } from '@workspace/codepath-common/repository'

import { createRepo as createRepoApi } from '@/lib/repos/client'
import type { CreateRepoFormData } from '@/utils/validators/createRepoForm'

interface ReposState {
  error: GenericNullable<string>
  loading: boolean
  repos: Repository[]
}

const initialState: ReposState = {
  error: null,
  loading: false,
  repos: []
}

export const createRepo = createAsyncThunk('repos/createRepo',
  async (repo: CreateRepoFormData, { rejectWithValue }) => {
    try {
      return await createRepoApi(repo)
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message ?? 'Cannot create repo')
    }
  }
)

const reposSlice = createSlice({
  initialState,
  name: 'repos',
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
    })
  },
  reducers: {
    clearError: state => {
      state.error = null
    },
    setRepos: (state, action: PayloadAction<Repository[]>) => {
      state.repos = action.payload
    }
  }
})

export const { clearError, setRepos } = reposSlice.actions
export default reposSlice.reducer
