'use client'

import { create } from 'zustand'

import type { User } from '@/interfaces/auth'
import type { GenericNullable } from '@/interfaces/globals'
import { getCurrentUser, login, register } from '@/lib/auth/auth'
import { logoutAction } from '@/lib/auth/authServer'

interface Store {
  user: GenericNullable<User>
  loading: boolean
  register: (email: string, login: string, password: string) => Promise<void>
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  getMe: () => Promise<void>
  clearError: () => void
  error: string | null
}

export const useAuthStore = create<Store>((setState, getState) => ({
  user: null,
  loading: false,
  error: null,

  clearError: () => setState({ error: null }),

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
      const user = await getCurrentUser()
      setState({ user, loading: false })
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
      // Clear state first
      setState({ user: null, loading: false, error: null })
      // Call server action - it will handle cookie deletion and redirect
      await logoutAction()
    } catch (error) {
      console.error('Logout error:', error)
      setState({ loading: false })
    }
  },

  getMe: async () => {
    const hasToken = typeof window !== 'undefined' && document.cookie.includes('access_token=')

    if (!hasToken) {
      setState({ user: null, loading: false })
      return
    }

    setState({ loading: true, error: null })
    try {
      const user = await getCurrentUser()
      setState({ user, loading: false })
    } catch (error) {
      setState({ user: null, loading: false })
    }
  },
}))
