import { Module } from '@nestjs/common'

import { HttpClientModule } from '../http-client/http-client.module'
import { OrchestratorClient } from './services/orchestrator-client.service'

@Module({
  exports: [OrchestratorClient],
  imports: [HttpClientModule],
  providers: [OrchestratorClient]
})
export class OrchestratorClientModule {}
