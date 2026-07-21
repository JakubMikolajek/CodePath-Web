import { Readable } from 'node:stream'

import axios, { AxiosError } from 'axios'

import {
  type OrchestratorChatStreamEvent,
  OrchestratorClient
} from './services/orchestrator-client.service'

async function collectChatEvents(stream: AsyncIterable<OrchestratorChatStreamEvent>): Promise<OrchestratorChatStreamEvent[]> {
  const events: OrchestratorChatStreamEvent[] = []

  for await (const event of stream) events.push(event)

  return events
}

jest.mock('axios')

describe('orchestrator client', () => {
  const axiosIsAxiosErrorMock = jest.mocked(axios.isAxiosError)
  const requestMock = jest.fn()
  const client = new OrchestratorClient({
    request: requestMock
  } as never)

  beforeEach(() => {
    axiosIsAxiosErrorMock.mockImplementation((error): error is AxiosError => error instanceof AxiosError)
    requestMock.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('times out chat rpc request when orchestrator does not respond', async () => {
    requestMock.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }))

    await expect(collectChatEvents(client.streamChatRpc({
      prompt: 'timeout me',
      repoId: 1
    }))).rejects.toThrow('Orchestrator request timed out')
  })

  it('parses multiple SSE frames from a single readable chunk', async () => {
    requestMock.mockResolvedValue({
      data: Readable.from([
        'event: chunk\ndata: {"delta":"hel","done":false}\n\nevent: chunk\ndata: {"delta":"lo","done":false}\n\nevent: done\ndata: {"delta":"!","done":true}\n\n'
      ]),
      status: 200,
      statusText: 'OK'
    })

    await expect(collectChatEvents(client.streamChatRpc({
      prompt: 'hello',
      repoId: 2
    }))).resolves.toEqual([
      { delta: 'hel', done: false, type: 'chunk' },
      { delta: 'lo', done: false, type: 'chunk' },
      { delta: '!', done: true, type: 'done' }
    ])

    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({ accept: 'text/event-stream' }),
      responseType: 'stream',
      url: expect.stringContaining('/v1/chat/rpc')
    }))
  })

  it('buffers an SSE frame split across readable chunks', async () => {
    const encoded = Buffer.from('event: chunk\ndata: {"delta":"zażółć","done":false}\n\nevent: done\ndata: {"delta":"","done":true}\n\n')

    requestMock.mockResolvedValue({
      data: Readable.from([
        encoded.subarray(0, 18),
        encoded.subarray(18, 37),
        encoded.subarray(37, 44),
        encoded.subarray(44)
      ]),
      status: 200,
      statusText: 'OK'
    })

    await expect(collectChatEvents(client.streamChatRpc({
      prompt: 'split the stream',
      repoId: 3
    }))).resolves.toEqual([
      { delta: 'zażółć', done: false, type: 'chunk' },
      { delta: '', done: true, type: 'done' }
    ])
  })

  it('passes through a terminal SSE error event', async () => {
    requestMock.mockResolvedValue({
      data: Readable.from([
        'event: chunk\ndata: {"delta":"partial","done":false}\n\n',
        'event: error\ndata: {"code":"CHAT_STREAM_IDLE_TIMEOUT","message":"stream timed out"}\n\n'
      ]),
      status: 200,
      statusText: 'OK'
    })

    await expect(collectChatEvents(client.streamChatRpc({
      prompt: 'fail eventually',
      repoId: 4
    }))).resolves.toEqual([
      { delta: 'partial', done: false, type: 'chunk' },
      { code: 'CHAT_STREAM_IDLE_TIMEOUT', message: 'stream timed out', type: 'error' }
    ])
  })

  it('rejects ingest publish when producer payload is invalid', async () => {
    await expect(client.enqueueIngestJob({
      contractVersion: 'ingest.v2',
      correlationId: '',
      messageType: 'ingest.job.request',
      payload: {
        parseOptions: {
          includeConfigFiles: true,
          includeDocumentationFiles: true,
          maxFileBytes: 5000,
          maxSegmentChars: 1000
        },
        snapshot: {
          bucket: 'codepath-repos',
          key: 'repos/1/snapshot.tar.gz',
          provider: 'minio',
          sourceCommitSha: 'abcdef'
        }
      },
      producedAt: new Date().toISOString(),
      producer: 'web-api',
      repoId: 1
    } as never)).rejects.toMatchObject({
      message: 'Ingest job payload failed producer-side contract validation',
      name: 'OrchestratorClientError'
    })

    expect(requestMock).not.toHaveBeenCalled()
  })

  it('publishes ingest job when producer payload is valid', async () => {
    requestMock.mockResolvedValue({
      data: '',
      status: 202,
      statusText: 'Accepted'
    })

    await expect(client.enqueueIngestJob({
      contractVersion: 'ingest.v2',
      correlationId: 'corr-1',
      messageType: 'ingest.job.request',
      payload: {
        parseOptions: {
          includeConfigFiles: true,
          includeDocumentationFiles: true,
          maxFileBytes: 5000,
          maxSegmentChars: 1000
        },
        snapshot: {
          bucket: 'codepath-repos',
          key: 'repos/1/snapshot.tar.gz',
          provider: 'minio',
          sourceCommitSha: 'abcdef'
        }
      },
      producedAt: new Date().toISOString(),
      producer: 'web-api',
      repoId: 1
    } as never)).resolves.toBeUndefined()

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ repoId: 1 }),
      method: 'POST',
      url: expect.stringContaining('/v1/jobs/ingest'),
      validateStatus: expect.any(Function)
    }))
  })

  it('publishes evaluation job to the orchestrator evaluation endpoint', async () => {
    requestMock.mockResolvedValue({
      data: '',
      status: 202,
      statusText: 'Accepted'
    })

    await expect(client.enqueueEvaluationJob({
      repoId: 7,
      runType: 'docs_quality'
    })).resolves.toBeUndefined()

    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        repoId: 7,
        runType: 'docs_quality'
      },
      method: 'POST',
      url: expect.stringContaining('/v1/jobs/evaluation'),
      validateStatus: expect.any(Function)
    }))
  })
})
