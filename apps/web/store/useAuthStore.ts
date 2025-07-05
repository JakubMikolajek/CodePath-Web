import { redirect } from 'next/navigation'
import { create } from 'zustand/react'

import { User } from '@/interfaces/auth'
import { GenericNullable } from '@/interfaces/globals'
import { getCurrentUser, login, register } from '@/lib/auth'


interface Store {
  user: GenericNullable<User>
  loading: boolean
  register: (email: string, login: string, password: string)=> Promise<void>
  login: (identifier: string, password: string)=> Promise<void>
  logout: () => void
  getMe: () => Promise<void>
}

export const useAuthStore = create<Store>((setState) => ({
  user: null,
  loading: true,
  register: async (email, login, password) => {
    setState(() => ({ loading: true }))
    try {
      await register(email, login, password)
      setState(() => ({ loading: false }))
    } catch {
      setState(() => ({ loading: false }))
    }
  },
  login: async (identifier, password) => {
    setState(() => ({ loading: true }))
    try {
      await login(identifier, password)
      const user = await getCurrentUser()
      setState(() => ({ user, loading: false }))
    } catch {
      setState(() => ({ user: null, loading: false }))
    }
  },
  logout: () => {
    setState(() => ({ user: null }))
    document.cookie = 'access_token=; Max-Age=0; path=/'
    if (typeof window !== 'undefined') {
      redirect('/')
    }
  },
  getMe: async () => {
    setState(() => ({ loading: true }))
    try {
      const user = await getCurrentUser()
      setState(() => ({ user,  loading: false }))
    } catch {
      setState(() => ({ user: null, loading: false }))
    }
  },
}))
