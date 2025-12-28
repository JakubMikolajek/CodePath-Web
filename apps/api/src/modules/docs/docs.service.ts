import { Injectable } from '@nestjs/common'
import * as amqp from 'amqplib'
import { eq } from 'drizzle-orm'

import { DbService } from '../db/db.service'
import { files } from '../db/schema'
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

  async generateDocumentation(repoId: number): Promise<string> {
    const repoFiles = await this.dbService.dbClient.select()
      .from(files)
      .where(eq(files.repoId, repoId))

    for (const file of repoFiles) {
      const scrollResult = await this.qdrantService.scroll('embeddings', {
        must: [
          {
            key: 'fileId',
            match: {
              value: file.id
            }
          }
        ]
      })

      const fileEmbeddings = scrollResult.points.map(point => point.payload)

      this.channel.sendToQueue(
        this.quque,
        Buffer.from(JSON.stringify({ embeddings: fileEmbeddings })),
        { persistent: true }
      )
    }

    return 'TEST'
  }

  async onModuleDestroy() {
    await this.channel?.close()
    await this.conn?.close()
  }

  async onModuleInit() {
    this.conn = await amqp.connect('amqp://admin:admin@192.168.1.245')
    this.channel = await this.conn.createChannel()
    await this.channel.assertQueue(this.quque, { durable: true })
  }
}
