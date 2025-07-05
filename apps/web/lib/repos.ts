import { cookies } from 'next/headers'

import { Repo } from '@/interfaces/repo'
import { apiServer } from '@/lib/api/api'

export async function fetchRepos() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('access_token')?.value

  const cookieHeader = `access_token=${accessToken}`

  const api = apiServer(cookieHeader)

  return await api.get<Repo[]>('/repo')
}
