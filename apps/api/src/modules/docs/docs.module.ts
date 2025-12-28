import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { EmbeddingModule } from '../embedding/embedding.module'
import { QdrantModule } from '../qdrant/qdrant.module'
import { DocsController } from './docs.controller'
import { DocsService } from './docs.service'

@Module({
  controllers: [DocsController],
  imports: [HttpModule, EmbeddingModule, QdrantModule],
  providers: [DocsService]
})
export class DocsModule { }
