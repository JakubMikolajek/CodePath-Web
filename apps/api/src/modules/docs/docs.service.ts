import { Injectable } from '@nestjs/common'
import * as amqp from 'amqplib'
import { eq } from 'drizzle-orm'

import { DbService } from '../db/db.service'
import { files, repos } from '../db/schema'
import { QdrantService } from '../qdrant/qdrant.service'

@Injectable()
export class DocsService {
  private channel: amqp.Channel
  private conn: amqp.ChannelModel
  private readonly quque = 'docs'

  constructor(
    private readonly dbService: DbService,
    private readonly qdrantService: QdrantService
  ) { }

  async generateDocumentation(repoId: number) {
    this.channel.sendToQueue(
      this.quque,
      Buffer.from(JSON.stringify({ repoId })),
      { persistent: true }
    )

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
    this.conn = await amqp.connect('amqp://admin:admin@127.0.0.1')
    this.channel = await this.conn.createChannel()
    await this.channel.assertQueue(this.quque, { durable: true })
  }
}
