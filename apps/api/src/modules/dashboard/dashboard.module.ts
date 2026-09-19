import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { DbModule } from '../db/db.module'
import { QdrantModule } from '../qdrant/qdrant.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

@Module({
  controllers: [DashboardController],
  imports: [AuthModule, DbModule, QdrantModule],
  providers: [DashboardService]
})
export class DashboardModule { }
