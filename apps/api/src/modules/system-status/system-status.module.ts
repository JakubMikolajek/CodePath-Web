import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { DbModule } from '../db/db.module'
import { QdrantModule } from '../qdrant/qdrant.module'
import { RepoStorageModule } from '../repo-storage/repo-storage.module'
import { SystemStatusService } from './services/system-status.service'
import { SystemStatusController } from './system-status.controller'

@Module({
  controllers: [SystemStatusController],
  imports: [AuthModule, DbModule, QdrantModule, RepoStorageModule],
  providers: [SystemStatusService]
})
export class SystemStatusModule { }
