import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { OrchestratorClientModule } from '../orchestrator-client/orchestrator-client.module'
import { ChatController } from './chat.controller'
import { ChatService } from './services/chat.service'

@Module({
  controllers: [ChatController],
  imports: [
    OrchestratorClientModule,
    AuthModule
  ],
  providers: [ChatService]
})
export class ChatModule { }
