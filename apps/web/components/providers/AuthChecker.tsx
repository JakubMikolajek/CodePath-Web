'use client'

import { useEffect } from 'react'

import { useAuthStore } from '@/store'

export default function AuthChecker() {
  const { getMe } = useAuthStore()

  useEffect(() => {
    const hasToken = document.cookie.includes('access_token=')
    if (hasToken) {
      getMe()
    }
  }, [getMe])

  return null
}
