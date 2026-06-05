import { Module } from '@nestjs/common'

import { DbModule } from '../db/db.module'
import { QdrantModule } from '../qdrant/qdrant.module'
import { RepoStorageModule } from '../repo-storage/repo-storage.module'
import { SystemStatusService } from './services/system-status.service'
import { SystemStatusController } from './system-status.controller'

@Module({
  controllers: [SystemStatusController],
  imports: [DbModule, QdrantModule, RepoStorageModule],
  providers: [SystemStatusService]
})
export class SystemStatusModule { }
