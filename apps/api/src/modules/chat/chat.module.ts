import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  controllers: [ChatController],
  imports: [
    HttpModule
  ],
  providers: [ChatService]
})
export class ChatModule { }
