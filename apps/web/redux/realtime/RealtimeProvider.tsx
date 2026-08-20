'use client'

import type { Nullable } from '@workspace/codepath-common'
import type { Repository } from '@workspace/codepath-common/repository'
import { useEffect } from 'react'

import { docsApi, type RepoDocsStatusResponse } from '@/redux/api/docsApi'
import { evaluationApi } from '@/redux/api/evaluationApi'
import { reposApi } from '@/redux/api/reposApi'
import { store } from '@/redux/store'

import { getRealtimeSocket } from './socketClient'

type RepoPipelineUpdatedData = Pick<
  Repository,
  'cloneStatus' | 'docsStatus' | 'embeddingStatus' | 'id' | 'lastPipelineError' | 'pipelineUpdatedAt'
>

type ReposApiState = Parameters<ReturnType<typeof reposApi.endpoints.getRepos.select>>[0]
type RepoDocsStatusApiState = Parameters<ReturnType<typeof docsApi.endpoints.getRepoDocsStatus.select>>[0]

interface EvaluationRunData {
  completedAt: Nullable<string>
  errorMessage: Nullable<string>
  id?: number
  repoId: number
  runType: string
  status: string
  triggeredAt: string
}

type RealtimeEvent = {
  eventId: string
  occurredAt: string
  scope: 'user'
  scopeId: string
  version: 1
} & (
  | { data: EvaluationRunData; type: 'evaluation.run.queued' | 'evaluation.run.updated' }
  | { data: RepoPipelineUpdatedData; type: 'repo.pipeline.updated' }
)

export function RealtimeProvider() {
  useEffect(() => {
    const socket = getRealtimeSocket()

    socket.on('realtime.event', handleRealtimeEvent)
    socket.connect()

    return () => {
      socket.off('realtime.event', handleRealtimeEvent)
      socket.disconnect()
    }
  }, [])

  return null
}

function handleRealtimeEvent(event: RealtimeEvent): void {
  if (event.type === 'repo.pipeline.updated') {
    patchRepoPipelineStatus(event.data)
    return
  }

  store.dispatch(evaluationApi.util.invalidateTags([
    { id: event.data.repoId, type: 'EvaluationRuns' },
    { id: event.data.repoId, type: 'EvaluationTrend' }
  ]))
}

function patchRepoPipelineStatus(data: RepoPipelineUpdatedData): void {
  const reposCache = reposApi.endpoints.getRepos.select()(store.getState() as ReposApiState)

  if (reposCache.data) {
    store.dispatch(reposApi.util.updateQueryData('getRepos', undefined, repositories => {
      const repo = repositories.find(candidate => candidate.id === data.id)

      if (repo) applyRepoPipelineStatus(repo, data)
    }))
  }

  const docsStatusCache = docsApi.endpoints.getRepoDocsStatus.select(data.id)(store.getState() as RepoDocsStatusApiState)

  if (docsStatusCache.data) {
    store.dispatch(docsApi.util.updateQueryData('getRepoDocsStatus', data.id, docsStatus => { applyRepoPipelineStatus(docsStatus, data) }))
  }
}

function applyRepoPipelineStatus(
  target: Pick<RepoDocsStatusResponse, 'cloneStatus' | 'docsStatus' | 'embeddingStatus' | 'lastPipelineError' | 'pipelineUpdatedAt'>,
  data: RepoPipelineUpdatedData
): void {
  target.cloneStatus = data.cloneStatus
  target.docsStatus = data.docsStatus
  target.embeddingStatus = data.embeddingStatus
  target.lastPipelineError = data.lastPipelineError
  target.pipelineUpdatedAt = data.pipelineUpdatedAt
}
