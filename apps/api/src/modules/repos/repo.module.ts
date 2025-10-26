import { Module } from '@nestjs/common'

import { RepoController } from './repo.controller'
import { RepoService } from './repo.service'
import { RepoFetcherService } from './repo-fetcher.service'

@Module({
  controllers: [RepoController],
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
