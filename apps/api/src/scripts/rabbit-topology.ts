import * as amqp from 'amqplib'

import { env } from '../config/env'
import {
  migrateQueueTopologies,
  type QueueTopologyConfig,
  verifyQueueTopologies
} from '../modules/rabbitmq/topology'

export enum RabbitTopologyMode {
  MIGRATE = 'migrate',
  VERIFY = 'verify'
}

const SUPPORTED_MODES = new Set([RabbitTopologyMode.VERIFY, RabbitTopologyMode.MIGRATE])

function readMode(): RabbitTopologyMode {
  const mode = process.argv[2] as RabbitTopologyMode ?? RabbitTopologyMode.VERIFY

  if (SUPPORTED_MODES.has(mode)) return mode

  throw new Error(`Unsupported mode '${mode}'. Use 'verify' or 'migrate'.`)
}

function topologyConfigs(): QueueTopologyConfig[] {
  return [
    { queueName: 'chat', retryDelayMs: env.rabbitRetryDelayMs },
    { queueName: 'docs', retryDelayMs: env.rabbitRetryDelayMs },
    { queueName: 'embedding', retryDelayMs: env.rabbitRetryDelayMs },
    { queueName: 'ingest', retryDelayMs: env.rabbitRetryDelayMs },
    { queueName: 'ingest-status', retryDelayMs: env.rabbitRetryDelayMs }
  ]
}

async function run(): Promise<void> {
  const mode = readMode()
  const conn = await amqp.connect(env.rabbitUrl)
  const channel = await conn.createChannel()
  const configs = topologyConfigs()

  try {
    if (mode === RabbitTopologyMode.MIGRATE) {
      await migrateQueueTopologies(channel, configs)
      console.log('RabbitMQ topology migration completed.')
      return
    }

    await verifyQueueTopologies(channel, configs)
    console.log('RabbitMQ topology verification passed.')
  } finally {
    await channel.close().catch(() => {})
    await conn.close().catch(() => {})
  }
}

run().catch(error => {
  console.error('Rabbit topology command failed:', error)
  process.exitCode = 1
})
