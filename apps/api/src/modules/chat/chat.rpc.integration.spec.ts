import { v4 as uuidv4 } from 'uuid'

import { OrchestratorClientError, requestChatRpc } from '../../lib/orchestrator-client'
import { emitTelemetry } from '../../lib/telemetry'
import { ChatService } from './services/chat.service'

jest.mock('../../lib/orchestrator-client', () => {
  const actual = jest.requireActual('../../lib/orchestrator-client')
  return {
    ...actual,
    requestChatRpc: jest.fn()
  }
})

jest.mock('../../lib/telemetry', () => ({
  emitTelemetry: jest.fn()
}))

jest.mock('uuid', () => ({
  v4: jest.fn()
}))

describe('chat rpc integration', () => {
  const requestChatRpcMock = jest.mocked(requestChatRpc)
  const emitTelemetryMock = jest.mocked(emitTelemetry)
  const uuidV4Mock = uuidv4 as unknown as jest.MockedFunction<() => string>

  const service = new ChatService(
    { dbClient: {} } as never
  )

  beforeEach(() => {
    jest.restoreAllMocks()
    requestChatRpcMock.mockReset()
    emitTelemetryMock.mockReset()
    uuidV4Mock.mockReset()
    uuidV4Mock.mockReturnValue('corr-test-001')
  })

  it('keeps correlation id between request and timeout telemetry events', async () => {
    const timeoutError = new OrchestratorClientError('Orchestrator request timed out')
    requestChatRpcMock.mockRejectedValue(timeoutError)
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_450)

    await expect(
      (service as unknown as { publishChatJob: (payload: { prompt: string, repoId: number }) => Promise<string> })
        .publishChatJob({ prompt: 'hello', repoId: 42 })
    ).rejects.toBe(timeoutError)

    expect(requestChatRpcMock).toHaveBeenCalledWith({ prompt: 'hello', repoId: 42 })
    expect(emitTelemetryMock).toHaveBeenCalledTimes(2)

    const [requestEvent, timeoutEvent] = emitTelemetryMock.mock.calls.map(([payload]) => payload)

    expect(requestEvent).toMatchObject({
      component: 'chat.rpc',
      correlationId: 'corr-test-001',
      event: 'chat_rpc_request_published',
      queueName: 'chat',
      repoId: 42,
      service: 'web-api',
      status: 'ok'
    })
    expect(timeoutEvent).toMatchObject({
      component: 'chat.rpc',
      correlationId: 'corr-test-001',
      event: 'chat_rpc_timeout',
      queueName: 'chat',
      repoId: 42,
      service: 'web-api',
      status: 'timeout'
    })
    expect(timeoutEvent.durationMs).toBe(450)
  })

  it('keeps correlation id between request and response telemetry events', async () => {
    requestChatRpcMock.mockResolvedValue('answer')
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(2_320)

    await expect(
      (service as unknown as { publishChatJob: (payload: { prompt: string, repoId: number }) => Promise<string> })
        .publishChatJob({ prompt: 'question', repoId: 77 })
    ).resolves.toBe('answer')

    expect(emitTelemetryMock).toHaveBeenCalledTimes(2)
    const [requestEvent, responseEvent] = emitTelemetryMock.mock.calls.map(([payload]) => payload)

    expect(requestEvent).toMatchObject({
      correlationId: 'corr-test-001',
      event: 'chat_rpc_request_published',
      repoId: 77
    })
    expect(responseEvent).toMatchObject({
      correlationId: 'corr-test-001',
      event: 'chat_rpc_response_received',
      repoId: 77,
      status: 'ok'
    })
    expect(responseEvent.durationMs).toBe(320)
  })
})
