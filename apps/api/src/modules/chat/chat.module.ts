import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { EmbeddingModule } from '../embedding/embedding.module'
import { Embedding } from '../embedding/entities/embedding.entity'

import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  imports: [
    HttpModule,
    EmbeddingModule,
    TypeOrmModule.forFeature([Embedding]),
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
