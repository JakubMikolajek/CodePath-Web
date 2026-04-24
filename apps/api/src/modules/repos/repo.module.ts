import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
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
  imports: [RepoStorageModule, AuthModule],
  providers: [
    RepoService,
    RepoFetcherService
  ]
})
export class RepoModule { }
