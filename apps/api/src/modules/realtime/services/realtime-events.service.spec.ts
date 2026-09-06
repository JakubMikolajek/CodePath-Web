import { Test } from '@nestjs/testing'

import { RealtimeGateway } from '../realtime.gateway'
import { RealtimeEventsService } from './realtime-events.service'
import { RealtimeRoomService } from './realtime-room.service'

describe('RealtimeEventsService', () => {
  const emit = jest.fn()
  const to = jest.fn(() => ({ emit }))
  const gateway = { server: { to } }

  beforeEach(() => {
    jest.resetAllMocks()
    to.mockReturnValue({ emit })
  })

  it('emits a versioned full repo pipeline payload to the owning user room', async () => {
    const module = await Test.createTestingModule({
      providers: [
        RealtimeEventsService,
        RealtimeRoomService,
        { provide: RealtimeGateway, useValue: gateway }
      ]
    }).compile()
    const service = module.get(RealtimeEventsService)
    const data = {
      cloneStatus: 'cloned',
      docsStatus: 'ready',
      embeddingStatus: 'embedded',
      id: 12,
      lastPipelineError: null,
      pipelineUpdatedAt: '2026-08-19T10:00:00.000Z'
    }

    const event = service.emitRepoPipelineUpdated(4, data)

    expect(to).toHaveBeenCalledWith('user:4')
    expect(emit).toHaveBeenCalledWith('realtime.event', expect.objectContaining({
      data,
      eventId: expect.any(String),
      occurredAt: expect.any(String),
      scope: 'user',
      scopeId: '4',
      type: 'repo.pipeline.updated',
      version: 1
    }))
    expect(event.data).toBe(data)
  })
})
