'use server'

import { IUser } from '@workspace/codepath-common/user'
import { cookies } from 'next/headers'

import { apiServer } from '@/lib/api/api'

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const cookie = cookieStore.toString()

  const api = apiServer(cookie)

  return api.get<IUser>('/auth/me')
}
