'use server'

import type { IUser } from '@workspace/codepath-common/user'

import { apiServer } from '@/lib/api/api'

export async function getCurrentUser(cookie: string) {
  const api = apiServer(cookie)

  return api.get<IUser>('/auth/me')
}
