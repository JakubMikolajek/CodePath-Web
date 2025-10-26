'use client'

import type { GenericNullable } from '@workspace/codepath-common/globals'
import type { IUser } from '@workspace/codepath-common/user'
import { create } from 'zustand'

import { login, logout, register } from '@/lib/auth/client'

interface Store {
  clearError: () => void
  error: GenericNullable<string>
  loading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, login: string, password: string) => Promise<void>
  setMe: (user: IUser) => void
  user: GenericNullable<IUser>
}

export const useAuthStore = create<Store>(setState => ({
  error: null,
  loading: false,
  user: null,

  clearError: () => setState(() => ({ error: null })),

  login: async (identifier, password) => {
    setState({ error: null, loading: true })
    try {
      await login(identifier, password)
      setState({ loading: false })
      window.location.href = '/dashboard'
    } catch (error: any) {
      setState({
        error: error.response?.data?.message ?? 'Login failed',
        loading: false,
        user: null
      })
      throw error
    }
  },

  logout: async () => {
    setState({ loading: true })
    try {
      setState({ error: null, loading: false, user: null })
      await logout()
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
      setState({ loading: false })
    }
  },

  register: async (email, login, password) => {
    setState({ error: null, loading: true })
    try {
      await register(email, login, password)
      setState({ loading: false })
    } catch (error: any) {
      setState({
        error: error.response?.data?.message ?? 'Registration failed',
        loading: false
      })
      throw error
    }
  },

  setMe: user => setState(() => ({ user }))
}))
