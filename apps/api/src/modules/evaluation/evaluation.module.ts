import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { OrchestratorClientModule } from '../orchestrator-client/orchestrator-client.module'
import { RealtimeModule } from '../realtime/realtime.module'
import { EvaluationController } from './evaluation.controller'
import { EvaluationService } from './services/evaluation.service'

@Module({
  controllers: [EvaluationController],
  imports: [OrchestratorClientModule, AuthModule, RealtimeModule],
  providers: [EvaluationService]
})
export class EvaluationModule { }
