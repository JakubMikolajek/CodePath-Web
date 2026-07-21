import { Logger } from '@nestjs/common'
import { lastValueFrom, toArray } from 'rxjs'

import type { OrchestratorChatStreamEvent } from '../orchestrator-client/services/orchestrator-client.service'
import { emitTelemetry } from '../telemetry/services/telemetry'
import { ChatService } from './services/chat.service'

jest.mock('../telemetry/services/telemetry', () => ({
  emitTelemetry: jest.fn()
}))

describe('chat rpc integration', () => {
  const emitTelemetryMock = jest.mocked(emitTelemetry)
  const insertValuesMock = jest.fn()
  const orchestratorClient = {
    streamChatRpc: jest.fn()
  }
  const dbClient = {
    insert: jest.fn(() => ({ values: insertValuesMock })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => ({
          limit: jest.fn().mockResolvedValue([{ id: 'session-1' }])
        }))
      }))
    }))
  }

  let service: ChatService

  beforeEach(() => {
    jest.restoreAllMocks()
    emitTelemetryMock.mockReset()
    insertValuesMock.mockReset().mockResolvedValue(undefined)
    orchestratorClient.streamChatRpc.mockReset()
    jest.spyOn(Logger.prototype, 'log').mockImplementation()
    jest.spyOn(Logger.prototype, 'error').mockImplementation()

    service = new ChatService(
      { dbClient } as never,
      orchestratorClient as never
    )
  })

  it('persists the accumulated assistant message before emitting done', async () => {
    orchestratorClient.streamChatRpc.mockImplementation(() => createStream([
      { delta: 'Hello', done: false, type: 'chunk' },
      { delta: ' world', done: false, type: 'chunk' },
      { delta: '!', done: true, type: 'done' }
    ]))
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(2_320)

    const stream = await service.askAboutRepo(9, 77, {
      question: 'question',
      sessionId: 'session-1'
    })
    const events = await lastValueFrom(stream.pipe(toArray()))

    expect(events).toEqual([
      { data: { delta: 'Hello', done: false }, type: 'chunk' },
      { data: { delta: ' world', done: false }, type: 'chunk' },
      { data: { delta: '!', done: true }, type: 'done' }
    ])
    expect(insertValuesMock).toHaveBeenNthCalledWith(1, {
      content: 'question',
      role: 'user',
      sessionId: 'session-1',
      userId: 9
    })
    expect(insertValuesMock).toHaveBeenNthCalledWith(2, {
      content: 'Hello world!',
      role: 'assistant',
      sessionId: 'session-1',
      userId: 9
    })

    const [requestEvent, responseEvent] = emitTelemetryMock.mock.calls
      .map(([payload]) => payload)
      .filter(payload => payload.component === 'chat.rpc')

    expect(requestEvent).toMatchObject({
      correlationId: expect.any(String),
      event: 'chat_rpc_request_published',
      repoId: 77
    })
    expect(responseEvent).toMatchObject({
      correlationId: requestEvent.correlationId,
      durationMs: 320,
      event: 'chat_rpc_response_received',
      repoId: 77,
      status: 'ok'
    })
  })

  it('does not persist a partial assistant message when the stream emits error', async () => {
    orchestratorClient.streamChatRpc.mockImplementation(() => createStream([
      { delta: 'Partial answer', done: false, type: 'chunk' },
      {
        code: 'CHAT_STREAM_INVALID_CHUNK',
        message: 'invalid upstream chunk',
        type: 'error'
      }
    ]))

    const stream = await service.askAboutRepo(10, 42, {
      question: 'question',
      sessionId: 'session-1'
    })
    const events = await lastValueFrom(stream.pipe(toArray()))

    expect(events).toEqual([
      { data: { delta: 'Partial answer', done: false }, type: 'chunk' },
      {
        data: {
          code: 'CHAT_STREAM_INVALID_CHUNK',
          message: 'invalid upstream chunk'
        },
        type: 'error'
      }
    ])
    expect(insertValuesMock).toHaveBeenCalledTimes(1)
    expect(insertValuesMock).not.toHaveBeenCalledWith(expect.objectContaining({ role: 'assistant' }))
    expect(emitTelemetryMock).toHaveBeenCalledWith(expect.objectContaining({
      details: {
        errorCode: 'CHAT_STREAM_INVALID_CHUNK',
        errorMessage: 'invalid upstream chunk'
      },
      event: 'chat_rpc_stream_error_received',
      status: 'error'
    }))
  })
})

async function* createStream(events: OrchestratorChatStreamEvent[]): AsyncGenerator<OrchestratorChatStreamEvent> {
  for (const event of events) yield await Promise.resolve(event)
}
