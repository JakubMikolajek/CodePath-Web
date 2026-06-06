import { Injectable } from '@nestjs/common'
import * as amqp from 'amqplib'
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
  status: ComponentStatus
}

export interface SystemStatusResponse {
  checkedAt: string
  components: SystemComponentStatus[]
  status: ComponentStatus
}

const REQUIRED_QUEUES = ['chat', 'docs', 'embedding', 'ingest', 'ingest-status'] as const

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
      const connection = await this.withTimeout(amqp.connect(env.rabbitUrl), 'RabbitMQ connection timed out')
      const channel = await connection.createChannel()

      try {
        for (const queueName of REQUIRED_QUEUES) {
          await channel.checkQueue(queueName)
        }

        return { details: { queues: REQUIRED_QUEUES.length }, message: `Required queues available: ${REQUIRED_QUEUES.length}` }
      } finally {
        await channel.close().catch(() => undefined)
        await connection.close().catch(() => undefined)
      }
    })
  }

  private async checkRepoStorage() {
    return await this.measure('Repo storage', async () => {
      const result = await this.withTimeout(this.repoStorageService.checkHealth(), 'Repository storage check timed out')

      return { details: { provider: result.provider }, message: result.message }
    })
  }

  private async measure(
    name: string,
    check: () => Promise<string | { details?: Record<string, number | string>, message: string }>
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
        status: ComponentStatus.OK
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
}
