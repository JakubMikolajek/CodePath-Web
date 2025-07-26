import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { EmbeddingModule } from '../embedding/embedding.module'

import { DocsController } from './docs.controller'
import { DocsService } from './docs.service'

@Module({
  imports: [HttpModule, EmbeddingModule],
  controllers: [DocsController],
  providers: [DocsService],
})
export class DocsModule { }
