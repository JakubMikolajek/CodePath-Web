'use server'

import type { Repository } from '@workspace/codepath-common/repository'

import { apiServer } from '../api/api'

export async function getRepos() {
  const api = apiServer()

  return api.get<Repository[]>('/repo')
}
