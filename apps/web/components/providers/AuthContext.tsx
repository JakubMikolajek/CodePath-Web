'use client'

import { useRouter } from 'next/navigation'
import {
  ReactNode,
  useEffect,
} from 'react'

import { useAuthStore } from '@/store'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { getMe, loading, user } = useAuthStore()

  useEffect(() => {
    getMe()
  }, [])

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [loading, user])

  if (loading) {
    return <div>Loading…</div>
  }

  return <>{children}</>
}
