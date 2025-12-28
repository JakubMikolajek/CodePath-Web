import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { GenericNullable } from '@workspace/codepath-common/globals'
import type { IUser } from '@workspace/codepath-common/user'

import { login as loginApi, logout as logoutApi, register as registerApi } from '@/lib/auth/client'

interface AuthState {
  error: GenericNullable<string>
  loading: boolean
  user: GenericNullable<IUser>
}

const initialState: AuthState = {
  error: null,
  loading: false,
  user: null
}

export const login = createAsyncThunk('auth/login',
  async ({ identifier, password }: { identifier: string; password: string }, { rejectWithValue }) => {
    try {
      await loginApi(identifier, password)
      window.location.href = '/dashboard'
      return
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message ?? 'Login failed')
    }
  }
)

export const logout = createAsyncThunk('auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await logoutApi()
      window.location.href = '/'
    } catch (error: any) {
      console.error('Logout error:', error)
      return rejectWithValue(error.message)
    }
  })

export const register = createAsyncThunk('auth/register',
  async ({ email, login, password }: { email: string; login: string; password: string }, { rejectWithValue }) => {
    try {
      await registerApi(email, login, password)
      return
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message ?? 'Registration failed')
    }
  }
)

const authSlice = createSlice({
  initialState,
  name: 'auth',
  extraReducers: builder => {
    builder.addCase(login.pending, state => {
      state.loading = true
      state.error = null
    }).addCase(login.fulfilled, state => {
      state.loading = false
    }).addCase(login.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
      state.user = null
    }).addCase(logout.pending, state => {
      state.loading = true
      state.error = null
      state.user = null
    }).addCase(logout.fulfilled, state => {
      state.loading = false
      state.user = null
    }).addCase(logout.rejected, state => {
      state.loading = false
      state.user = null
    }).addCase(register.pending, state => {
      state.loading = true
      state.error = null
    }).addCase(register.fulfilled, state => {
      state.loading = false
    }).addCase(register.rejected, (state, action) => {
      state.loading = false
      state.error = action.payload as string
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
