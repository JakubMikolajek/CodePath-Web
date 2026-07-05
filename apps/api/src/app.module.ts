import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'

import { ApiExplorerModule } from './modules/api-explorer/api-explorer.module'
import { AuthModule } from './modules/auth/auth.module'
import { ChatModule } from './modules/chat/chat.module'
import { DbModule } from './modules/db/db.module'
import { DocsModule } from './modules/docs/docs.module'
import { EvaluationModule } from './modules/evaluation/evaluation.module'
import { DependenciesModule } from './modules/graphs/dependencies.module'
import { MetricsModule } from './modules/metrics/metrics.module'
import { RepoModule } from './modules/repos/repo.module'
import { SystemStatusModule } from './modules/system-status/system-status.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DbModule,
    ApiExplorerModule,
    ChatModule,
    RepoModule,
    AuthModule,
    DependenciesModule,
    DocsModule,
    EvaluationModule,
    MetricsModule,
    SystemStatusModule
  ]
})
export class AppModule { }
