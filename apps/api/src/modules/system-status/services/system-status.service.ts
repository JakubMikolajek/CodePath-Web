import { Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'

import { env } from '../../../config/env'
import { DbService } from '../../db/services/db.service'
import { QdrantService } from '../../qdrant/services/qdrant.service'
import { RepoStorageService } from '../../repo-storage/services/repo-storage.service'

export enum ComponentStatus {
  DEGRADED = 'degraded',
  DOWN = 'down',
  OK = 'ok'
}

export interface SystemComponentStatus {
  checkedAt: string
  details?: Record<string, number | string>
  latencyMs: number
  message: string
  name: string
  queues?: RabbitQueueGroupStatus[]
  status: ComponentStatus
}

export interface SystemStatusResponse {
  checkedAt: string
  components: SystemComponentStatus[]
  status: ComponentStatus
}

const REQUIRED_QUEUES = ['chat', 'docs', 'embedding', 'ingest', 'ingest-status'] as const
type RequiredQueueName = (typeof REQUIRED_QUEUES)[number]

interface RabbitQueueLaneStatus {
  consumers: number
  messages: number
  name: string
  ready: number
  unacknowledged: number
}

export interface RabbitQueueGroupStatus {
  dlq: RabbitQueueLaneStatus
  main: RabbitQueueLaneStatus
  name: RequiredQueueName
  retry: RabbitQueueLaneStatus
  status: ComponentStatus
}

interface RabbitManagementQueue {
  consumers?: number
  messages?: number
  messages_ready?: number
  messages_unacknowledged?: number
  name?: string
}

type ComponentCheckResult = string | {
  details?: Record<string, number | string>
  message: string
  queues?: RabbitQueueGroupStatus[]
  status?: ComponentStatus
}

@Injectable()
export class SystemStatusService {
  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService,
    private readonly repoStorageService: RepoStorageService
  ) { }

  async getStatus(): Promise<SystemStatusResponse> {
    const components = await Promise.all([
      this.checkApi(),
      this.checkDatabase(),
      this.checkQdrant(),
      this.checkRabbitMq(),
      this.checkRepoStorage(),
      this.checkOrchestrator()
    ])

    return { checkedAt: new Date().toISOString(), components, status: this.resolveOverallStatus(components) }
  }

  private async checkApi() {
    return await this.measure('API', async () => 'HTTP API is responding')
  }

  private async checkDatabase() {
    return await this.measure('Postgres', async () => {
      await this.withTimeout(this.dbService.dbClient.execute(sql`select 1`), 'Postgres check timed out')

      return 'Database query succeeded'
    })
  }

  private async checkOrchestrator() {
    return await this.measure('Orchestrator', async () => {
      const response = await this.withTimeout(fetch(new URL('/healthz', env.orchestratorUrl)), 'Orchestrator health check timed out')

      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`)

      return `/healthz returned HTTP ${response.status}`
    })
  }

  private async checkQdrant() {
    return await this.measure('Qdrant', async () => {
      const collections = await this.withTimeout(this.qdrantService.getCollections(), 'Qdrant check timed out')
      const count = Array.isArray(collections.collections) ? collections.collections.length : 0

      return { details: { collections: count }, message: `Collections reachable: ${count}` }
    })
  }

  private async checkRabbitMq() {
    return await this.measure('RabbitMQ', async () => {
      const queueMetrics = await this.fetchRabbitQueues()
      const queues: RabbitQueueGroupStatus[] = []

      for (const queueName of REQUIRED_QUEUES) queues.push(this.checkRabbitQueueGroup(queueMetrics, queueName))

      const degradedQueues = queues.filter(queue => queue.status !== ComponentStatus.OK)
      const totals = queues.reduce((acc, queue) => ({
        consumers: acc.consumers + queue.main.consumers,
        dlqMessages: acc.dlqMessages + queue.dlq.messages,
        ready: acc.ready + queue.main.ready,
        retryMessages: acc.retryMessages + queue.retry.messages,
        unacknowledged: acc.unacknowledged + queue.main.unacknowledged
      }), { consumers: 0, dlqMessages: 0, ready: 0, retryMessages: 0, unacknowledged: 0 })

      const status = degradedQueues.length > 0 ? ComponentStatus.DEGRADED : ComponentStatus.OK
      const message = status === ComponentStatus.OK
        ? `Required queues healthy: ${queues.length}`
        : `Queue issues: ${degradedQueues.map(queue => queue.name).join(', ')}`

      return {
        details: {
          consumers: totals.consumers,
          dlqMessages: totals.dlqMessages,
          queues: queues.length,
          ready: totals.ready,
          retryMessages: totals.retryMessages,
          unacknowledged: totals.unacknowledged
        },
        message,
        queues,
        status
      }
    })
  }

  private async fetchRabbitQueues(): Promise<Map<string, RabbitManagementQueue>> {
    const response = await this.withTimeout(
      fetch(this.rabbitManagementQueuesUrl(), {
        headers: {
          authorization: this.rabbitManagementAuthorizationHeader()
        }
      }),
      'RabbitMQ management check timed out'
    )

    if (!response.ok) throw new Error(`RabbitMQ management returned HTTP ${response.status}`)

    const payload = await response.json() as unknown

    if (!Array.isArray(payload)) throw new Error('RabbitMQ management returned invalid queue payload')

    const queues = new Map<string, RabbitManagementQueue>()

    for (const item of payload) {
      if (!this.isRabbitManagementQueue(item)) continue
      queues.set(item.name, item)
    }

    return queues
  }

  private checkRabbitQueueGroup(
    queueMetrics: Map<string, RabbitManagementQueue>,
    queueName: RequiredQueueName
  ): RabbitQueueGroupStatus {
    const main = this.checkRabbitQueueLane(queueMetrics, queueName)
    const retry = this.checkRabbitQueueLane(queueMetrics, `${queueName}.retry`)
    const dlq = this.checkRabbitQueueLane(queueMetrics, `${queueName}.dlq`)

    const status = main.consumers < 1 || retry.messages > 0 || dlq.messages > 0
      ? ComponentStatus.DEGRADED
      : ComponentStatus.OK

    return { dlq, main, name: queueName, retry, status }
  }

  private checkRabbitQueueLane(
    queueMetrics: Map<string, RabbitManagementQueue>,
    queueName: string
  ): RabbitQueueLaneStatus {
    const result = queueMetrics.get(queueName)
    const ready = this.coerceQueueMetric(result?.messages_ready)
    const unacknowledged = this.coerceQueueMetric(result?.messages_unacknowledged)

    return {
      consumers: this.coerceQueueMetric(result?.consumers),
      messages: this.coerceQueueMetric(result?.messages ?? ready + unacknowledged),
      name: queueName,
      ready,
      unacknowledged
    }
  }

  private async checkRepoStorage() {
    return await this.measure('Repo storage', async () => {
      const result = await this.withTimeout(this.repoStorageService.checkHealth(), 'Repository storage check timed out')

      return { details: { provider: result.provider }, message: result.message }
    })
  }

  private async measure(
    name: string,
    check: () => Promise<ComponentCheckResult>
  ): Promise<SystemComponentStatus> {
    const startedAt = performance.now()
    const checkedAt = new Date().toISOString()

    try {
      const result = await check()
      const normalized = typeof result === 'string' ? { message: result } : result

      return {
        checkedAt,
        details: normalized.details,
        latencyMs: Math.round(performance.now() - startedAt),
        message: normalized.message,
        name,
        queues: normalized.queues,
        status: normalized.status ?? ComponentStatus.OK
      }
    } catch (error) {
      return {
        checkedAt,
        latencyMs: Math.round(performance.now() - startedAt),
        message: error instanceof Error ? error.message : String(error),
        name,
        status: ComponentStatus.DOWN
      }
    }
  }

  private resolveOverallStatus(components: SystemComponentStatus[]): ComponentStatus {
    if (components.some(component => component.status === ComponentStatus.DOWN)) return ComponentStatus.DOWN
    if (components.some(component => component.status === ComponentStatus.DEGRADED)) return ComponentStatus.DEGRADED

    return ComponentStatus.OK
  }

  private async withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined

    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error(message)), env.systemStatusTimeoutMs)

      if (typeof timeout === 'object' && timeout && 'unref' in timeout && typeof timeout.unref === 'function') timeout.unref()
    })

    try {
      return await Promise.race([promise, timeoutPromise])
    } finally {
      if (timeout) clearTimeout(timeout)
    }
  }

  private coerceQueueMetric(value: number | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0

    return Math.trunc(value)
  }

  private isRabbitManagementQueue(value: unknown): value is RabbitManagementQueue & { name: string } {
    return typeof value === 'object'
      && value !== null
      && 'name' in value
      && typeof (value as { name?: unknown }).name === 'string'
  }

  private rabbitManagementAuthorizationHeader(): string {
    const rabbitUrl = new URL(env.rabbitUrl)
    const username = decodeURIComponent(rabbitUrl.username || 'guest')
    const password = decodeURIComponent(rabbitUrl.password || 'guest')

    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  }

  private rabbitManagementQueuesUrl(): string {
    const rabbitUrl = new URL(env.rabbitUrl)
    const vhost = decodeURIComponent(rabbitUrl.pathname.replace(/^\//, '')) || '/'
    const url = new URL('/api/queues/', env.rabbitManagementUrl)
    url.pathname = `/api/queues/${encodeURIComponent(vhost)}`

    return url.toString()
  }
}
