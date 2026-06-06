import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { HttpClientModule } from '../http-client/http-client.module'
import { QdrantModule } from '../qdrant/qdrant.module'
import { ApiExplorerController } from './api-explorer.controller'
import { ApiRunnerAuthPresetsRepository } from './repositories/api-runner-auth-presets.repository'
import { ApiRunnerCollectionsRepository } from './repositories/api-runner-collections.repository'
import { ApiExplorerService } from './services/api-explorer.service'
import { ApiRunnerService } from './services/api-runner.service'

@Module({
  controllers: [ApiExplorerController],
  imports: [AuthModule, QdrantModule, HttpClientModule],
  providers: [
    ApiExplorerService,
    ApiRunnerService,
    ApiRunnerAuthPresetsRepository,
    ApiRunnerCollectionsRepository
  ]
})
export class ApiExplorerModule {}
