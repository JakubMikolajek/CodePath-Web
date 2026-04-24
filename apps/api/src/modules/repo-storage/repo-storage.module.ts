import { Module } from '@nestjs/common'

import { RepoStorageService } from './services/repo-storage.service'

@Module({
  exports: [RepoStorageService],
  providers: [RepoStorageService]
})
export class RepoStorageModule { }
