import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { Nullable } from '@workspace/codepath-common/globals'
import type { IUser } from '@workspace/codepath-common/user'

interface AuthState {
  error: Nullable<string>
  loading: boolean
  user: Nullable<IUser>
}

const initialState: AuthState = {
  error: null,
  loading: false,
  user: null
}

export const logout = createAsyncThunk('auth/logout', () => window.location.assign('/api/auth/logout'))

const authSlice = createSlice({
  initialState,
  name: 'auth',
  extraReducers: builder => {
    builder.addCase(logout.pending, state => {
      state.loading = true
      state.error = null
      state.user = null
    }).addCase(logout.fulfilled, state => {
      state.loading = false
      state.user = null
    }).addCase(logout.rejected, state => {
      state.loading = false
      state.user = null
    })
  },
  reducers: {
    clearError: state => {
      state.error = null
    },
    setMe: (state, action: PayloadAction<IUser>) => {
      state.user = action.payload
    }
  }
})

export const { clearError, setMe } = authSlice.actions
export default authSlice.reducer
