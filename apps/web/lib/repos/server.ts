'use server'

import type { Repository } from '@workspace/codepath-common/repository'

import { apiServer } from '../api/api'

export async function getRepos(cookie: string) {
  const api = apiServer(cookie)

  return api.get<Repository[]>('/repo')
}
