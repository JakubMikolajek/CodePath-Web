'use server'

import { cookies } from 'next/headers'

import { User } from '@/interfaces/auth'
import { apiServer } from '@/lib/api/api'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const cookie = cookieStore.toString()

  const api = apiServer(cookie)

  return api.get<User>('/auth/me')
}
