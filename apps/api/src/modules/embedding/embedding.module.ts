import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { DocsSegment } from '../docs/entity/docs-segments.entity'
import { Dependencies } from '../graphs/entity/dependencies.entity'
import { File } from '../repos/entities/file.entity'

import { EmbeddingController } from './embedding.controller'
import { EmbeddingService } from './embedding.service'
import { Embedding } from './entities/embedding.entity'

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      File,
      Embedding,
      Dependencies,
      DocsSegment,
    ]),
  ],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
