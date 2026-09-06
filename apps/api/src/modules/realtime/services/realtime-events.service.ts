import { randomUUID } from 'node:crypto'

import { Injectable } from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common'

import { RealtimeGateway } from '../realtime.gateway'
import { RealtimeRoomService } from './realtime-room.service'

export type RealtimeEventType = 'evaluation.run.queued' | 'evaluation.run.updated' | 'repo.pipeline.updated'

export interface RealtimeEvent<TData> {
  data: TData
  eventId: string
  occurredAt: string
  scope: 'user'
  scopeId: string
  type: RealtimeEventType
  version: 1
}

export interface RepoPipelineStatusEventData {
  cloneStatus: string
  docsStatus: string
  embeddingStatus: string
  id: number
  lastPipelineError: Nullable<string>
  pipelineUpdatedAt: Nullable<string>
}

export interface EvaluationRunEventData {
  completedAt: Nullable<string>
  errorMessage: Nullable<string>
  id?: number
  repoId: number
  runType: string
  status: string
  triggeredAt: string
}

@Injectable()
export class RealtimeEventsService {
  constructor(
    private readonly realtimeGateway: RealtimeGateway,
    private readonly realtimeRoomService: RealtimeRoomService
  ) {}

  emitEvaluationRunQueued(userId: number, data: EvaluationRunEventData): RealtimeEvent<EvaluationRunEventData> {
    return this.emit(userId, 'evaluation.run.queued', data)
  }

  emitEvaluationRunUpdated(userId: number, data: EvaluationRunEventData): RealtimeEvent<EvaluationRunEventData> {
    return this.emit(userId, 'evaluation.run.updated', data)
  }

  emitRepoPipelineUpdated(userId: number, data: RepoPipelineStatusEventData): RealtimeEvent<RepoPipelineStatusEventData> {
    return this.emit(userId, 'repo.pipeline.updated', data)
  }

  private emit<TData>(userId: number, type: RealtimeEventType, data: TData): RealtimeEvent<TData> {
    const event: RealtimeEvent<TData> = {
      data,
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      scope: 'user',
      scopeId: String(userId),
      type,
      version: 1
    }

    this.realtimeGateway.server.to(this.realtimeRoomService.user(userId)).emit('realtime.event', event)

    return event
  }
}
