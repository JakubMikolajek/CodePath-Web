import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { EmbeddingService } from './embedding.service'

@Module({
  exports: [EmbeddingService],
  imports: [HttpModule],
  providers: [EmbeddingService]
})
export class EmbeddingModule { }
