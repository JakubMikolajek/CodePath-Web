import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { OrchestratorClientModule } from '../orchestrator-client/orchestrator-client.module'
import { RepoStorageModule } from '../repo-storage/repo-storage.module'
import { RepoController } from './repo.controller'
import { RepoService } from './services/repo.service'
import { RepoFetcherService } from './services/repo-fetcher.service'

@Module({
  controllers: [RepoController],
  exports: [
    RepoService,
    RepoFetcherService
  ],
  imports: [RepoStorageModule, AuthModule, OrchestratorClientModule],
  providers: [
    RepoService,
    RepoFetcherService
  ]
})
export class RepoModule { }
