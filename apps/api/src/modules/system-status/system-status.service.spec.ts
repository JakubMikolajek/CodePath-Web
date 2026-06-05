import * as amqp from 'amqplib'

import { SystemStatusService } from './services/system-status.service'

jest.mock('amqplib', () => ({
  connect: jest.fn()
}))

describe('SystemStatusService', () => {
  const originalFetch = global.fetch
  const amqpConnectMock = jest.mocked(amqp.connect)

  afterEach(() => {
    jest.restoreAllMocks()
    amqpConnectMock.mockReset()
    if (originalFetch) global.fetch = originalFetch
  })

  it('reports ok when every dependency responds', async () => {
    const channel = {
      checkQueue: jest.fn().mockResolvedValue({}),
      close: jest.fn().mockResolvedValue(undefined)
    }
    const connection = {
      close: jest.fn().mockResolvedValue(undefined),
      createChannel: jest.fn().mockResolvedValue(channel)
    }
    amqpConnectMock.mockResolvedValue(connection as never)
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response) as typeof fetch

    const service = new SystemStatusService(
      { dbClient: { execute: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } } as never,
      { getCollections: jest.fn().mockResolvedValue({ collections: [{ name: 'embeddings' }] }) } as never,
      { checkHealth: jest.fn().mockResolvedValue({ message: 'MinIO ok', provider: 'minio' }) } as never
    )

    const result = await service.getStatus()

    expect(result.status).toBe('ok')
    expect(result.components).toHaveLength(6)
    expect(channel.checkQueue).toHaveBeenCalledWith('ingest-status')
  })

  it('reports down when a dependency check fails', async () => {
    amqpConnectMock.mockRejectedValue(new Error('rabbit down'))
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 } as Response) as typeof fetch

    const service = new SystemStatusService(
      { dbClient: { execute: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } } as never,
      { getCollections: jest.fn().mockResolvedValue({ collections: [] }) } as never,
      { checkHealth: jest.fn().mockResolvedValue({ message: 'local ok', provider: 'local' }) } as never
    )

    const result = await service.getStatus()
    const rabbit = result.components.find(component => component.name === 'RabbitMQ')

    expect(result.status).toBe('down')
    expect(rabbit).toMatchObject({
      message: 'rabbit down',
      status: 'down'
    })
  })
})
