'use server'

import type { IUser } from '@workspace/codepath-common/user'

import { apiServer } from '@/lib/api/api'

export async function getCurrentUser() {
  const api = await apiServer()

  return api.get<IUser>('/auth/me')
}
