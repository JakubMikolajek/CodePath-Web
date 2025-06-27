import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { File } from './entities/file.entity'
import { Repo } from './entities/repo.entity'
import { RepoController } from './repo.controller'
import { RepoService } from './repo.service'

@Module({
  imports: [TypeOrmModule.forFeature([Repo, File])],
  controllers: [RepoController],
  providers: [RepoService],
})
export class RepoModule {}
