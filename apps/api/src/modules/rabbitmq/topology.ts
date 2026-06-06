import {
  TelemetryLevel,
  TelemetryRuntimeFamily,
  TelemetryService,
  TelemetryStatus
} from '@workspace/codepath-common/telemetry'
import type * as amqp from 'amqplib'

import { emitTelemetry } from '../telemetry/services/telemetry'

export interface QueueTopologyConfig {
  queueName: string
  retryDelayMs: number
}

export interface EnsureQueueTopologyOptions {
  allowRecreateOnMismatch?: boolean
}

interface TopologyNames {
  dlq: string
  dlx: string
  retryQueue: string
}

function topologyNames(queueName: string): TopologyNames {
  return {
    dlq: `${queueName}.dlq`,
    dlx: `${queueName}.dlx`,
    retryQueue: `${queueName}.retry`
  }
}

function isPreconditionFailed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const maybeCode = Reflect.get(error, 'code') as unknown

  if (typeof maybeCode === 'number' && maybeCode === 406) return true

  const maybeMessage = Reflect.get(error, 'message') as unknown

  if (typeof maybeMessage !== 'string') return false

  return maybeMessage.includes('PRECONDITION_FAILED')
}

async function declareTopology(channel: amqp.Channel, config: QueueTopologyConfig): Promise<void> {
  const { queueName, retryDelayMs } = config
  const { dlq, dlx, retryQueue } = topologyNames(queueName)

  await channel.assertExchange(dlx, 'direct', { durable: true })
  await channel.assertQueue(dlq, { durable: true })
  await channel.bindQueue(dlq, dlx, queueName)

  await channel.assertQueue(queueName, {
    arguments: {
      'x-dead-letter-exchange': dlx,
      'x-dead-letter-routing-key': queueName
    },
    durable: true
  })

  await channel.assertQueue(retryQueue, {
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': queueName,
      'x-message-ttl': retryDelayMs
    },
    durable: true
  })

  emitTelemetry({
    component: 'rabbitmq.topology',
    details: { retryDelayMs },
    event: 'queue_topology_verified',
    level: TelemetryLevel.INFO,
    queueName,
    runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
    service: TelemetryService.WEB_API,
    status: TelemetryStatus.OK
  })
}

async function recreateTopology(channel: amqp.Channel, config: QueueTopologyConfig): Promise<void> {
  const { queueName } = config
  const { dlq, dlx, retryQueue } = topologyNames(queueName)

  await Promise.allSettled([
    channel.deleteQueue(retryQueue),
    channel.deleteQueue(queueName),
    channel.deleteQueue(dlq),
    channel.deleteExchange(dlx)
  ])

  await declareTopology(channel, config)

  emitTelemetry({
    component: 'rabbitmq.topology',
    details: { action: 'recreate' },
    event: 'queue_topology_migrated',
    level: TelemetryLevel.WARN,
    queueName,
    runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
    service: TelemetryService.WEB_API,
    status: TelemetryStatus.OK
  })
}

function mismatchMessage(queueName: string): string {
  return [
    `RabbitMQ topology mismatch for queue '${queueName}'.`,
    'Run `bun run rabbit:verify` to inspect topology or',
    '`bun run rabbit:migrate` to recreate queue topology (destructive).'
  ].join(' ')
}

export async function ensureQueueTopology(channel: amqp.Channel, config: QueueTopologyConfig, options: EnsureQueueTopologyOptions = {}): Promise<void> {
  try {
    await declareTopology(channel, config)
  } catch (error) {
    if (!isPreconditionFailed(error)) {
      emitTelemetry({
        component: 'rabbitmq.topology',
        event: 'queue_topology_verify_failed',
        level: TelemetryLevel.ERROR,
        queueName: config.queueName,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.ERROR
      })
      throw error
    }

    if (!options.allowRecreateOnMismatch) {
      emitTelemetry({
        component: 'rabbitmq.topology',
        event: 'queue_topology_mismatch',
        level: TelemetryLevel.ERROR,
        queueName: config.queueName,
        runtimeFamily: TelemetryRuntimeFamily.PIPELINE,
        service: TelemetryService.WEB_API,
        status: TelemetryStatus.ERROR
      })
      throw new Error(mismatchMessage(config.queueName), { cause: error })
    }

    await recreateTopology(channel, config)
  }
}

export async function verifyQueueTopologies(channel: amqp.Channel, configs: QueueTopologyConfig[]): Promise<void> {
  for (const config of configs) {
    await ensureQueueTopology(channel, config)
  }
}

export async function migrateQueueTopologies(channel: amqp.Channel, configs: QueueTopologyConfig[]): Promise<void> {
  for (const config of configs) {
    await recreateTopology(channel, config)
  }
}
