import { Module } from '@nestjs/common'

import { QdrantService } from './qdrant.service'

@Module({
  exports: [QdrantService],
  providers: [QdrantService]
})
export class QdrantModule { }
