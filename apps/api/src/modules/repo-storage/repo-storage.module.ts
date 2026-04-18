import { Module } from '@nestjs/common'

import { RepoStorageService } from './repo-storage.service'

@Module({
  exports: [RepoStorageService],
  providers: [RepoStorageService]
})
export class RepoStorageModule { }
