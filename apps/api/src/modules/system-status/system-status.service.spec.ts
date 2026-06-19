import { SystemStatusService } from './services/system-status.service'

describe('SystemStatusService', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalFetch) global.fetch = originalFetch
  })

  it('reports ok when every dependency responds', async () => {
    const fetchMock = jest.fn((input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('/api/queues/')) return Promise.resolve({
        json: () => Promise.resolve(queuePayload()),
        ok: true,
        status: 200
      } as Response)

      return Promise.resolve({ ok: true, status: 200 } as Response)
    }) as typeof fetch

    global.fetch = fetchMock

    const service = new SystemStatusService(
      { dbClient: { execute: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } } as never,
      { getCollections: jest.fn().mockResolvedValue({ collections: [{ name: 'embeddings' }] }) } as never,
      { checkHealth: jest.fn().mockResolvedValue({ message: 'MinIO ok', provider: 'minio' }) } as never
    )

    const result = await service.getStatus()

    expect(result.status).toBe('ok')
    expect(result.components).toHaveLength(6)
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:15672/api/queues/%2F', expect.objectContaining({
      headers: expect.objectContaining({ authorization: expect.stringMatching(/^Basic /) })
    }))
  })

  it('reports degraded when a required queue has no consumer or DLQ messages', async () => {
    global.fetch = jest.fn((input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('/api/queues/')) return Promise.resolve({
        json: () => Promise.resolve(queuePayload({
          'chat.dlq': { messages: 2, messages_ready: 2 },
          docs: { consumers: 0 }
        })),
        ok: true,
        status: 200
      } as Response)

      return Promise.resolve({ ok: true, status: 200 } as Response)
    }) as typeof fetch

    const service = new SystemStatusService(
      { dbClient: { execute: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } } as never,
      { getCollections: jest.fn().mockResolvedValue({ collections: [{ name: 'embeddings' }] }) } as never,
      { checkHealth: jest.fn().mockResolvedValue({ message: 'MinIO ok', provider: 'minio' }) } as never
    )

    const result = await service.getStatus()
    const rabbit = result.components.find(component => component.name === 'RabbitMQ')

    expect(result.status).toBe('degraded')
    expect(rabbit).toMatchObject({
      details: expect.objectContaining({ dlqMessages: 2 }),
      message: 'Queue issues: chat, docs',
      status: 'degraded'
    })
    expect(rabbit?.queues?.find(queue => queue.name === 'docs')?.main.consumers).toBe(0)
  })

  it('reports down when a dependency check fails', async () => {
    global.fetch = jest.fn((input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('/api/queues/')) return Promise.resolve({
        ok: false,
        status: 503
      } as Response)

      return Promise.resolve({ ok: true, status: 200 } as Response)
    }) as typeof fetch

    const service = new SystemStatusService(
      { dbClient: { execute: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } } as never,
      { getCollections: jest.fn().mockResolvedValue({ collections: [] }) } as never,
      { checkHealth: jest.fn().mockResolvedValue({ message: 'local ok', provider: 'local' }) } as never
    )

    const result = await service.getStatus()
    const rabbit = result.components.find(component => component.name === 'RabbitMQ')

    expect(result.status).toBe('down')
    expect(rabbit).toMatchObject({
      message: 'RabbitMQ management returned HTTP 503',
      status: 'down'
    })
  })
})

function queuePayload(overrides: Record<string, Partial<{
  consumers: number
  messages: number
  messages_ready: number
  messages_unacknowledged: number
}>> = {}) {
  const queues = ['chat', 'docs', 'embedding', 'ingest', 'ingest-status']

  return queues.flatMap(queue => [queue, `${queue}.retry`, `${queue}.dlq`].map(name => ({
    consumers: name.includes('.') ? 0 : 1,
    messages: 0,
    messages_ready: 0,
    messages_unacknowledged: 0,
    name,
    ...overrides[name]
  })))
}
