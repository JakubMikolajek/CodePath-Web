import { OrchestratorClientError } from '../orchestrator-client/services/orchestrator-client.service'
import { emitTelemetry } from '../telemetry/services/telemetry'
import { ChatService } from './services/chat.service'

jest.mock('../telemetry/services/telemetry', () => ({
  emitTelemetry: jest.fn()
}))

describe('chat rpc integration', () => {
  const emitTelemetryMock = jest.mocked(emitTelemetry)
  const orchestratorClient = {
    requestChatRpc: jest.fn()
  }

  const service = new ChatService(
    { dbClient: {} } as never,
    orchestratorClient as never
  )

  beforeEach(() => {
    jest.restoreAllMocks()
    orchestratorClient.requestChatRpc.mockReset()
    emitTelemetryMock.mockReset()
  })

  it('keeps correlation id between request and timeout telemetry events', async () => {
    const timeoutError = new OrchestratorClientError('Orchestrator request timed out')
    orchestratorClient.requestChatRpc.mockRejectedValue(timeoutError)
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_450)

    await expect(
      (service as unknown as { publishChatJob: (payload: { prompt: string, repoId: number }) => Promise<string> })
        .publishChatJob({ prompt: 'hello', repoId: 42 })
    ).rejects.toBe(timeoutError)

    expect(orchestratorClient.requestChatRpc).toHaveBeenCalledWith({ prompt: 'hello', repoId: 42 })
    expect(emitTelemetryMock).toHaveBeenCalledTimes(2)

    const [requestEvent, timeoutEvent] = emitTelemetryMock.mock.calls.map(([payload]) => payload)
    const correlationId = requestEvent.correlationId

    expect(requestEvent).toMatchObject({
      component: 'chat.rpc',
      correlationId: expect.any(String),
      event: 'chat_rpc_request_published',
      queueName: 'chat',
      repoId: 42,
      service: 'web-api',
      status: 'ok'
    })
    expect(timeoutEvent).toMatchObject({
      component: 'chat.rpc',
      correlationId,
      event: 'chat_rpc_timeout',
      queueName: 'chat',
      repoId: 42,
      service: 'web-api',
      status: 'timeout'
    })
    expect(timeoutEvent.durationMs).toBe(450)
  })

  it('keeps correlation id between request and response telemetry events', async () => {
    orchestratorClient.requestChatRpc.mockResolvedValue('answer')
    jest.spyOn(Date, 'now')
      .mockReturnValueOnce(2_000)
      .mockReturnValueOnce(2_320)

    await expect(
      (service as unknown as { publishChatJob: (payload: { prompt: string, repoId: number }) => Promise<string> })
        .publishChatJob({ prompt: 'question', repoId: 77 })
    ).resolves.toBe('answer')

    expect(emitTelemetryMock).toHaveBeenCalledTimes(2)
    const [requestEvent, responseEvent] = emitTelemetryMock.mock.calls.map(([payload]) => payload)
    const correlationId = requestEvent.correlationId

    expect(requestEvent).toMatchObject({
      correlationId: expect.any(String),
      event: 'chat_rpc_request_published',
      repoId: 77
    })
    expect(responseEvent).toMatchObject({
      correlationId,
      event: 'chat_rpc_response_received',
      repoId: 77,
      status: 'ok'
    })
    expect(responseEvent.durationMs).toBe(320)
  })
})
