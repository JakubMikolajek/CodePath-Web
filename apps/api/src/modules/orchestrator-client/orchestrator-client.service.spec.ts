import axios, { AxiosError } from 'axios'

import { OrchestratorClient } from './services/orchestrator-client.service'

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

    await expect(client.requestChatRpc({
      prompt: 'timeout me',
      repoId: 1
    })).rejects.toThrow('Orchestrator request timed out')
  })

  it('returns parsed chat response when orchestrator replies with json', async () => {
    requestMock.mockResolvedValue({
      data: JSON.stringify({ response: 'ok' }),
      status: 200,
      statusText: 'OK'
    })

    await expect(
      client.requestChatRpc({
        prompt: 'hello',
        repoId: 2
      })
    ).resolves.toBe('ok')
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
