import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { QdrantClient } from '@qdrant/js-client-rest'

@Injectable()
export class QdrantService implements OnModuleInit {
  private client: QdrantClient
  private readonly logger = new Logger(QdrantService.name)

  async onModuleInit() {
    this.client = new QdrantClient({
      host: '127.0.0.1',
      port: 6333
    })

    // Test connection
    try {
      await this.client.getCollections()
      this.logger.log('Connected to Qdrant')
    } catch (error) {
      this.logger.error('Failed to connect to Qdrant', error)
    }
  }

  async scroll(collectionName: string, filter?: any) {
    return await this.client.scroll(collectionName, {
      filter,
      limit: 1000, // Adjust limit as needed or implement pagination
      with_payload: true,
      with_vector: true
    })
  }

  async search(collectionName: string, vector: number[], filter?: any, limit = 5) {
    return await this.client.search(collectionName, {
      filter,
      limit,
      vector,
      with_payload: true
    })
  }
}
