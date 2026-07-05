import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { OrchestratorClientModule } from '../orchestrator-client/orchestrator-client.module'
import { EvaluationController } from './evaluation.controller'
import { EvaluationService } from './services/evaluation.service'

@Module({
  controllers: [EvaluationController],
  imports: [OrchestratorClientModule, AuthModule],
  providers: [EvaluationService]
})
export class EvaluationModule { }
