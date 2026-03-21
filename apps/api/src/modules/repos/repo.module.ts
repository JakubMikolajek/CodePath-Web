import { Module } from '@nestjs/common'

import { RepoStorageModule } from '../repo-storage/repo-storage.module'
import { RepoController } from './repo.controller'
import { RepoService } from './repo.service'
import { RepoFetcherService } from './repo-fetcher.service'

@Module({
  controllers: [RepoController],
  imports: [RepoStorageModule],
  exports: [
    RepoService,
    RepoFetcherService
  ],
  providers: [
    RepoService,
    RepoFetcherService
  ]
})
export class RepoModule { }
