import { Module } from '@nestjs/common'

import { QdrantService } from './services/qdrant.service'

@Module({
  exports: [QdrantService],
  providers: [QdrantService]
})
export class QdrantModule { }
