import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { File } from './entities/file.entity'
import { Repo } from './entities/repo.entity'
import { RepoFetcherService } from './repo-fetcher.service'
import { RepoController } from './repo.controller'
import { RepoService } from './repo.service'

@Module({
  imports: [TypeOrmModule.forFeature([Repo, File])],
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
export class RepoModule {}
