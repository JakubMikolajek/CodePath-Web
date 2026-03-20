import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'

import { AuthModule } from './modules/auth/auth.module'
import { ChatModule } from './modules/chat/chat.module'
import { DbModule } from './modules/db/db.module'
import { DocsModule } from './modules/docs/docs.module'
import { EmbeddingModule } from './modules/embedding/embedding.module'
import { DependenciesModule } from './modules/graphs/dependencies.module'
import { MetricsModule } from './modules/metrics/metrics.module'
import { RepoModule } from './modules/repos/repo.module'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DbModule,
    ChatModule,
    EmbeddingModule,
    RepoModule,
    AuthModule,
    DependenciesModule,
    DocsModule,
    MetricsModule
  ]
})
export class AppModule { }
