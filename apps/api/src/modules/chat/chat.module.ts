import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { EmbeddingModule } from '../embedding/embedding.module'

import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  imports: [
    HttpModule,
    EmbeddingModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule { }
