import type * as amqp from 'amqplib'

import {
  ensureQueueTopology,
  migrateQueueTopologies,
  verifyQueueTopologies
} from './topology'

function createChannelMock(): jest.Mocked<Pick<
  amqp.Channel,
  'assertExchange' | 'assertQueue' | 'bindQueue' | 'deleteExchange' | 'deleteQueue'
>> {
  return {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue({} as amqp.Replies.AssertQueue),
    bindQueue: jest.fn().mockResolvedValue({} as amqp.Replies.Empty),
    deleteExchange: jest.fn().mockResolvedValue({} as amqp.Replies.Empty),
    deleteQueue: jest.fn().mockResolvedValue({} as amqp.Replies.DeleteQueue)
  }
}

describe('rabbit topology', () => {
  const baseConfig = { queueName: 'chat', retryDelayMs: 5000 }

  it('declares retry and DLQ topology for queue', async () => {
    const channel = createChannelMock()

    await ensureQueueTopology(channel as unknown as amqp.Channel, baseConfig)

    expect(channel.assertExchange).toHaveBeenCalledWith('chat.dlx', 'direct', { durable: true })
    expect(channel.assertQueue).toHaveBeenNthCalledWith(1, 'chat.dlq', { durable: true })
    expect(channel.bindQueue).toHaveBeenCalledWith('chat.dlq', 'chat.dlx', 'chat')
    expect(channel.assertQueue).toHaveBeenNthCalledWith(2, 'chat', {
      arguments: {
        'x-dead-letter-exchange': 'chat.dlx',
        'x-dead-letter-routing-key': 'chat'
      },
      durable: true
    })
    expect(channel.assertQueue).toHaveBeenNthCalledWith(3, 'chat.retry', {
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'chat',
        'x-message-ttl': 5000
      },
      durable: true
    })
  })

  it('throws actionable error on topology mismatch without recreate', async () => {
    const channel = createChannelMock()
    let mismatchInjected = false

    const mismatchError = Object.assign(new Error('PRECONDITION_FAILED - inequivalent arg'), { code: 406 })
    channel.assertQueue.mockImplementation(queue => {
      if (queue === 'chat' && !mismatchInjected) {
        mismatchInjected = true
        throw mismatchError
      }

      return Promise.resolve({} as amqp.Replies.AssertQueue)
    })

    await expect(
      ensureQueueTopology(channel as unknown as amqp.Channel, baseConfig)
    ).rejects.toThrow("RabbitMQ topology mismatch for queue 'chat'")
  })

  it('recreates topology when mismatch is detected and migration is enabled', async () => {
    const channel = createChannelMock()
    let mismatchInjected = false

    const mismatchError = Object.assign(new Error('PRECONDITION_FAILED - inequivalent arg'), { code: 406 })
    channel.assertQueue.mockImplementation(queue => {
      if (queue === 'chat' && !mismatchInjected) {
        mismatchInjected = true
        throw mismatchError
      }

      return Promise.resolve({} as amqp.Replies.AssertQueue)
    })

    await ensureQueueTopology(channel as unknown as amqp.Channel, baseConfig, {
      allowRecreateOnMismatch: true
    })

    expect(channel.deleteQueue).toHaveBeenCalledWith('chat.retry')
    expect(channel.deleteQueue).toHaveBeenCalledWith('chat')
    expect(channel.deleteQueue).toHaveBeenCalledWith('chat.dlq')
    expect(channel.deleteExchange).toHaveBeenCalledWith('chat.dlx')
  })

  it('verifies and migrates multiple topologies', async () => {
    const channel = createChannelMock()
    const configs = [
      { queueName: 'chat', retryDelayMs: 5000 },
      { queueName: 'docs', retryDelayMs: 5000 }
    ]

    await verifyQueueTopologies(channel as unknown as amqp.Channel, configs)
    await migrateQueueTopologies(channel as unknown as amqp.Channel, configs)

    expect(channel.assertExchange).toHaveBeenCalledWith('chat.dlx', 'direct', { durable: true })
    expect(channel.assertExchange).toHaveBeenCalledWith('docs.dlx', 'direct', { durable: true })
    expect(channel.deleteQueue).toHaveBeenCalledWith('docs.retry')
  })
})
