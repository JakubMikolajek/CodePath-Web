import type * as amqp from 'amqplib'

import {
  ensureQueueTopology,
  migrateQueueTopologies,
  verifyQueueTopologies
} from './topology'

interface ExchangeDefinition {
  durable: boolean
  type: string
}

interface QueueDefinition {
  arguments: Record<string, unknown>
  durable: boolean
}

interface QueueBinding {
  exchange: string
  queue: string
  routingKey: string
}

interface InMemoryTopologyState {
  bindings: QueueBinding[]
  exchanges: Map<string, ExchangeDefinition>
  queues: Map<string, QueueDefinition>
}

function createInMemoryChannel(): {
  channel: jest.Mocked<Pick<
    amqp.Channel,
    'assertExchange' | 'assertQueue' | 'bindQueue' | 'deleteExchange' | 'deleteQueue'
  >>
  state: InMemoryTopologyState
} {
  const state: InMemoryTopologyState = {
    bindings: [],
    exchanges: new Map(),
    queues: new Map()
  }

  const channel: jest.Mocked<Pick<
    amqp.Channel,
    'assertExchange' | 'assertQueue' | 'bindQueue' | 'deleteExchange' | 'deleteQueue'
  >> = {
    assertExchange: jest.fn(async (exchange: string, type: string, options?: amqp.Options.AssertExchange) => {
      state.exchanges.set(exchange, {
        durable: options?.durable ?? false,
        type
      })
      return {} as amqp.Replies.Empty
    }),
    assertQueue: jest.fn(async (queue: string, options?: amqp.Options.AssertQueue) => {
      state.queues.set(queue, {
        arguments: { ...(options?.arguments ?? {}) },
        durable: options?.durable ?? false
      })
      return { queue } as unknown as amqp.Replies.AssertQueue
    }),
    bindQueue: jest.fn(async (queue: string, exchange: string, routingKey: string) => {
      state.bindings.push({
        exchange,
        queue,
        routingKey
      })
      return {} as amqp.Replies.Empty
    }),
    deleteExchange: jest.fn(async (exchange: string) => {
      state.exchanges.delete(exchange)
      return {} as amqp.Replies.Empty
    }),
    deleteQueue: jest.fn(async (queue: string) => {
      state.queues.delete(queue)
      state.bindings = state.bindings.filter(binding => binding.queue !== queue)
      return { messageCount: 0 } as unknown as amqp.Replies.DeleteQueue
    })
  }

  return { channel, state }
}

function resolveDeadLetterTargets(state: InMemoryTopologyState, queueName: string): string[] {
  const queue = state.queues.get(queueName)
  if (!queue) {
    throw new Error(`Queue '${queueName}' was not declared`)
  }

  const exchange = queue.arguments['x-dead-letter-exchange']
  const routingKey = queue.arguments['x-dead-letter-routing-key']
  if (typeof routingKey !== 'string' || routingKey.length === 0) {
    return []
  }

  if (exchange === '') {
    return state.queues.has(routingKey) ? [routingKey] : []
  }

  if (typeof exchange !== 'string' || exchange.length === 0) {
    return []
  }

  return state.bindings
    .filter(binding => binding.exchange === exchange && binding.routingKey === routingKey)
    .map(binding => binding.queue)
}

describe('rabbit topology integration', () => {
  it('wires retry TTL and dead-letter chain for queue family', async () => {
    const { channel, state } = createInMemoryChannel()

    await ensureQueueTopology(channel as unknown as amqp.Channel, {
      queueName: 'chat',
      retryDelayMs: 5000
    })

    expect(state.queues.get('chat.retry')?.arguments['x-message-ttl']).toBe(5000)
    expect(resolveDeadLetterTargets(state, 'chat.retry')).toEqual(['chat'])
    expect(resolveDeadLetterTargets(state, 'chat')).toEqual(['chat.dlq'])
  })

  it('keeps retry and dlq routes isolated per queue', async () => {
    const { channel, state } = createInMemoryChannel()
    const configs = [
      { queueName: 'chat', retryDelayMs: 5000 },
      { queueName: 'docs', retryDelayMs: 5000 },
      { queueName: 'embedding', retryDelayMs: 5000 }
    ]

    await verifyQueueTopologies(channel as unknown as amqp.Channel, configs)

    for (const { queueName } of configs) {
      expect(resolveDeadLetterTargets(state, `${queueName}.retry`)).toEqual([queueName])
      expect(resolveDeadLetterTargets(state, queueName)).toEqual([`${queueName}.dlq`])
    }
  })

  it('recreates queue family and restores retry ttl path during migration', async () => {
    const { channel, state } = createInMemoryChannel()

    state.queues.set('chat', {
      arguments: {
        'x-dead-letter-exchange': 'legacy.dlx',
        'x-dead-letter-routing-key': 'legacy'
      },
      durable: true
    })
    state.queues.set('chat.retry', {
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': 'legacy',
        'x-message-ttl': 100
      },
      durable: true
    })
    state.queues.set('chat.dlq', {
      arguments: {},
      durable: true
    })

    await migrateQueueTopologies(channel as unknown as amqp.Channel, [
      { queueName: 'chat', retryDelayMs: 5000 }
    ])

    expect(channel.deleteQueue).toHaveBeenCalledWith('chat.retry')
    expect(channel.deleteQueue).toHaveBeenCalledWith('chat')
    expect(channel.deleteQueue).toHaveBeenCalledWith('chat.dlq')
    expect(resolveDeadLetterTargets(state, 'chat.retry')).toEqual(['chat'])
    expect(resolveDeadLetterTargets(state, 'chat')).toEqual(['chat.dlq'])
  })
})
