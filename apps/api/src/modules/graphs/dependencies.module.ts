import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { OrchestratorClientModule } from '../orchestrator-client/orchestrator-client.module'
import { QdrantModule } from '../qdrant/qdrant.module'
import { DependenciesController } from './dependencies.controller'
import { DependenciesService } from './services/dependencies.service'

@Module({
  controllers: [DependenciesController],
  imports: [AuthModule, OrchestratorClientModule, QdrantModule],
  providers: [DependenciesService]
})
export class DependenciesModule { }
