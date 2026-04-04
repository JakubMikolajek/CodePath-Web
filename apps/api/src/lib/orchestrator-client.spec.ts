import { enqueueIngestJob, requestChatRpc } from './orchestrator-client'

describe('orchestrator client', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    if (originalFetch) {
      global.fetch = originalFetch
    }
  })

  it('times out chat rpc request when orchestrator does not respond', async () => {
    jest.useFakeTimers()

    const fetchMock = jest.fn((_url: URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal
      if (!signal) {
        return
      }

      if (signal.aborted) {
        reject(signal.reason ?? new Error('aborted'))
        return
      }

      signal.addEventListener('abort', () => {
        reject(signal.reason ?? new Error('aborted'))
      }, { once: true })
    }))

    global.fetch = fetchMock as typeof fetch

    const pending = requestChatRpc({
      prompt: 'timeout me',
      repoId: 1
    })

    const timeoutAssertion = expect(pending).rejects.toMatchObject({
      message: 'Orchestrator request timed out',
      name: 'OrchestratorClientError'
    })

    await jest.advanceTimersByTimeAsync(60_000)

    await timeoutAssertion
  })

  it('returns parsed chat response when orchestrator replies with json', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ response: 'ok' })
    } as Response) as typeof fetch

    await expect(
      requestChatRpc({
        prompt: 'hello',
        repoId: 2
      })
    ).resolves.toBe('ok')
  })

  it('rejects ingest publish when producer payload is invalid', async () => {
    const fetchMock = jest.fn()
    global.fetch = fetchMock as typeof fetch

    await expect(enqueueIngestJob({
      contractVersion: 'ingest.v1',
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

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('publishes ingest job when producer payload is valid', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () => ''
    } as Response)
    global.fetch = fetchMock as typeof fetch

    await expect(enqueueIngestJob({
      contractVersion: 'ingest.v1',
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

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/v1/jobs/ingest')
  })
})
