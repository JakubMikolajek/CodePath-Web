import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { File } from '../repos/entities/file.entity'

import { EmbeddingController } from './embedding.controller'
import { EmbeddingService } from './embedding.service'
import { Embedding } from './entities/embedding.entity'

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([File, Embedding]),
  ],
  controllers: [EmbeddingController],
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
