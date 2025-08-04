import { HttpService } from '@nestjs/axios'
import { Injectable, Logger } from '@nestjs/common'
import * as amqp from 'amqplib'
import { eq } from 'drizzle-orm'

import { DbService } from '../db/db.service'
import { embeddings, files } from '../db/schema'

@Injectable()
export class DocsService {
  private conn: amqp.ChannelModel
  private channel: amqp.Channel
  private readonly quque = 'docs'
  private logger: Logger = new Logger(DocsService.name)

  constructor(
    private readonly httpService: HttpService,
    private readonly dbService: DbService
  ) { }

  async onModuleInit() {
    this.conn = await amqp.connect('amqp://admin:admin@192.168.1.245')
    this.channel = await this.conn.createChannel()
    await this.channel.assertQueue(this.quque, { durable: true })
  }

  async onModuleDestroy() {
    await this.channel?.close()
    await this.conn?.close()
  }

  async generateDocumentation(repoId: number): Promise<string> {
    const repoFiles = await this.dbService.dbClient.select()
      .from(files)
      .where(eq(files.repoId, repoId))

    for (const file of repoFiles) {
      const fileEmbeddings = await this.dbService.dbClient.select()
        .from(embeddings)
        .where(eq(embeddings.fileId, file.id))

      this.channel.sendToQueue(
        this.quque,
        Buffer.from(JSON.stringify({ embeddings: fileEmbeddings })),
        { persistent: true }
      )
    }

    return 'TEST'
  }
}
