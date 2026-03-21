import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'

import { RepoStorageModule } from '../repo-storage/repo-storage.module'
import { EmbeddingService } from './embedding.service'

@Module({
  exports: [EmbeddingService],
  imports: [HttpModule, RepoStorageModule],
  providers: [EmbeddingService]
})
export class EmbeddingModule { }
