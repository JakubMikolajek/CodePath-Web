'use server'

import type { Repository } from '@workspace/codepath-common/repository'

import { apiServer } from '../api/apiServer'

export async function getRepos() {
  const api = await apiServer()

  return api.get<Repository[]>('/repo')
}
