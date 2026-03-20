import { Injectable } from '@nestjs/common'
import * as amqp from 'amqplib'
import { eq } from 'drizzle-orm'

import { env } from '../../config/env'
import { emitTelemetry } from '../../lib/telemetry'
import { DbService } from '../db/db.service'
import { repos } from '../db/schema'
import { QdrantService } from '../qdrant/qdrant.service'
import { ensureQueueTopology } from '../rabbitmq/topology'

@Injectable()
export class DocsService {
  private channel: amqp.Channel
  private conn: amqp.ChannelModel
  private readonly queue = 'docs'
  private readonly retryDelayMs = env.rabbitRetryDelayMs

  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService
  ) { }

  async generateDocumentation(repoId: number) {
    this.channel.sendToQueue(
      this.queue,
      Buffer.from(JSON.stringify({ repoId })),
      { persistent: true }
    )
    emitTelemetry({
      component: 'docs.service',
      event: 'docs_job_published',
      level: 'info',
      queueName: this.queue,
      repoId,
      runtimeFamily: 'pipeline',
      service: 'web-api',
      status: 'ok'
    })

    return { message: 'Documentation generation started' }
  }

  async getDocumentation(repoId: number) {
    const [repo] = await this.dbService.dbClient.select()
      .from(repos)
      .where(eq(repos.id, repoId))
      .limit(1)

    return repo?.documentation
  }

  async onModuleDestroy() {
    await this.channel?.close()
    await this.conn?.close()
  }

  async onModuleInit() {
    this.conn = await amqp.connect(env.rabbitUrl)
    this.channel = await this.conn.createChannel()
    await ensureQueueTopology(this.channel, {
      queueName: this.queue,
      retryDelayMs: this.retryDelayMs
    }, {
      allowRecreateOnMismatch: env.rabbitAllowDestructiveMigration
    })
  }
}
