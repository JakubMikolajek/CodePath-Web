import type { Repository } from '@workspace/codepath-common/repository'
import { describe, expect, it } from 'vitest'

import reposReducer, { dismissSyncError, getRepos } from './reposSlice'

describe('reposSlice', () => {
  const repoFixture: Repository = {
    cloneStatus: 'cloned',
    docsStatus: 'ready',
    embeddingStatus: 'embedded',
    id: 7,
    name: 'codepath-web'
  }

  it('sets syncing flag on getRepos.pending', () => {
    const nextState = reposReducer(undefined, getRepos.pending('req-1', undefined))

    expect(nextState.syncing).toBe(true)
    expect(nextState.syncError).toBeNull()
  })

  it('stores repositories and clears sync error on getRepos.fulfilled', () => {
    const stateWithError = reposReducer(undefined, getRepos.rejected(new Error('boom'), 'req-1', undefined, 'Cannot fetch repositories'))
    const nextState = reposReducer(
      stateWithError,
      getRepos.fulfilled([repoFixture], 'req-2', undefined)
    )

    expect(nextState.syncing).toBe(false)
    expect(nextState.syncError).toBeNull()
    expect(nextState.repos).toEqual([repoFixture])
  })

  it('tracks polling error and increments nonce on getRepos.rejected', () => {
    const firstState = reposReducer(undefined, getRepos.rejected(new Error('boom'), 'req-1', undefined, 'Cannot fetch repositories'))
    const secondState = reposReducer(firstState, getRepos.rejected(new Error('boom-again'), 'req-2', undefined, 'Cannot fetch repositories'))

    expect(firstState.syncError).toBe('Cannot fetch repositories')
    expect(firstState.syncErrorNonce).toBe(1)
    expect(secondState.syncErrorNonce).toBe(2)
  })

  it('clears sync error when dismissed', () => {
    const stateWithError = reposReducer(undefined, getRepos.rejected(new Error('boom'), 'req-1', undefined, 'Cannot fetch repositories'))
    const nextState = reposReducer(stateWithError, dismissSyncError())

    expect(nextState.syncError).toBeNull()
  })
})
