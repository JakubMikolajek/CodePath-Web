import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { OrchestratorClientModule } from '../orchestrator-client/orchestrator-client.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { DocsController } from './docs.controller'
import { DocsService } from './services/docs.service'

@Module({
  controllers: [DocsController],
  imports: [OrchestratorClientModule, AuthModule, RealtimeModule],
  providers: [DocsService]
})
export class DocsModule { }
