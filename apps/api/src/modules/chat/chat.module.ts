import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'

@Module({
  imports: [HttpModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
