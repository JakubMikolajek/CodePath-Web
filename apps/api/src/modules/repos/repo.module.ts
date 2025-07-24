import { Module } from '@nestjs/common'

import { RepoFetcherService } from './repo-fetcher.service'
import { RepoController } from './repo.controller'
import { RepoService } from './repo.service'

@Module({
  controllers: [RepoController],
  providers: [
    RepoService,
    RepoFetcherService,
  ],
  exports: [
    RepoService,
    RepoFetcherService,
  ],
})
export class RepoModule { }
