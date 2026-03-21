import { requestChatRpc } from './orchestrator-client'

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
})
