import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { QdrantClient, type Schemas } from '@qdrant/js-client-rest'

import { env } from '../../../config/env'

interface ScrollOptions {
  filter?: Schemas['Filter']
  limit?: number
  offset?: Schemas['ExtendedPointId']
  withPayload?: Schemas['WithPayloadInterface']
  withVector?: Schemas['WithVector']
}

@Injectable()
export class QdrantService implements OnModuleInit {
  private client: QdrantClient
  private readonly logger = new Logger(QdrantService.name)

  async count(collectionName: string, filter?: Schemas['Filter']) {
    return await this.client.count(collectionName, {
      exact: false,
      filter
    })
  }

  async getCollections() {
    return await this.client.getCollections()
  }

  async onModuleInit() {
    this.client = new QdrantClient({
      host: env.qdrantHost,
      port: env.qdrantPort
    })

    // Test connection
    try {
      await this.client.getCollections()
      this.logger.log('Connected to Qdrant')
    } catch (error) {
      this.logger.error('Failed to connect to Qdrant', error)
    }
  }

  async scroll(collectionName: string, options?: ScrollOptions) {
    const {
      filter,
      limit = 1000,
      offset,
      withPayload = true,
      withVector = false
    } = options ?? {}

    return await this.client.scroll(collectionName, {
      filter,
      limit,
      offset,
      with_payload: withPayload,
      with_vector: withVector
    })
  }

  async search(collectionName: string, vector: number[], filter?: Schemas['Filter'], limit = 5) {
    const result = await this.client.query(collectionName, {
      filter,
      limit,
      query: vector,
      with_payload: true
    })

    return result.points
  }
}
