import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { EmbeddingController } from './embedding.controller'
import { EmbeddingService } from './embedding.service'

@Module({
  imports: [HttpModule],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule { }
