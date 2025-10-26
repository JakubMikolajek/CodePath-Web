import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { LoggerModule } from 'nestjs-pino'

import { AuthModule } from './modules/auth/auth.module'
import { ChatModule } from './modules/chat/chat.module'
import { DbModule } from './modules/db/db.module'
import { DocsModule } from './modules/docs/docs.module'
import { EmbeddingModule } from './modules/embedding/embedding.module'
import { DependenciesModule } from './modules/graphs/dependencies.module'
import { RepoModule } from './modules/repos/repo.module'

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'debug',
        transport: {
          options: {
            colorize: true,
            colorizedObject: true,
            levelFirst: true,
            translateTime: 'HH:MM:ss'
          },
          target: 'pino-pretty'
        }
      }
    }),
    ScheduleModule.forRoot(),
    DbModule,
    ChatModule,
    EmbeddingModule,
    RepoModule,
    AuthModule,
    DependenciesModule,
    DocsModule
  ]
})
export class AppModule { }
