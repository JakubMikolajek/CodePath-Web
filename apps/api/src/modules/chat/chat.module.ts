import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ChatController } from './chat.controller'
import { ChatService } from './services/chat.service'

@Module({
  controllers: [ChatController],
  imports: [
    HttpModule,
    AuthModule
  ],
  providers: [ChatService]
})
export class ChatModule { }
