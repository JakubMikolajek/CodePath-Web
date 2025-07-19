import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { EmbeddingModule } from '../embedding/embedding.module'
import { Embedding } from '../embedding/entities/embedding.entity'

import { DocsController } from './docs.controller'
import { DocsService } from './docs.service'

@Module({
  imports: [HttpModule,
    EmbeddingModule,
    TypeOrmModule.forFeature([
      Embedding,
    ])],
  controllers: [DocsController],
  providers: [DocsService],
})
export class DocsModule {}
