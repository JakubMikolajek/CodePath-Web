'use client'

import { IUser } from '@workspace/codepath-common/user'
import { create } from 'zustand'

import type { GenericNullable } from '@/interfaces/globals'
import { login, register, logout } from '@/lib/auth/client'

interface Store {
  user: GenericNullable<IUser>
  loading: boolean
  register: (email: string, login: string, password: string) => Promise<void>
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setMe: (user: IUser) => void
  clearError: () => void
  error: GenericNullable<string>
}

export const useAuthStore = create<Store>((setState) => ({
  user: null,
  loading: false,
  error: null,

  clearError: () => setState(() => ({ error: null })),

  setMe: (user) => setState(() => ({ user })),

  register: async (email, login, password) => {
    setState({ loading: true, error: null })
    try {
      await register(email, login, password)
      setState({ loading: false })
    } catch (error: any) {
      setState({
        loading: false,
        error: error.response?.data?.message || 'Registration failed',
      })
      throw error
    }
  },

  login: async (identifier, password) => {
    setState({ loading: true, error: null })
    try {
      await login(identifier, password)
      setState({ loading: false })
      window.location.href = '/dashboard'
    } catch (error: any) {
      setState({
        user: null,
        loading: false,
        error: error.response?.data?.message || 'Login failed',
      })
      throw error
    }
  },

  logout: async () => {
    setState({ loading: true })
    try {
      setState({ user: null, loading: false, error: null })
      await logout()
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
      setState({ loading: false })
    }
  },
}))
