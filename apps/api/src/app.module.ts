import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LoggerModule } from 'nestjs-pino'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ChatModule } from './modules/chat/chat.module'
import { EmbeddingModule } from './modules/embedding/embedding.module'
import { RepoModule } from './modules/repos/repo.module'

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'debug',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            colorizedObject: true,
            levelFirst: true,
            translateTime: 'HH:MM:ss',
          },
        },
      },
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: '192.168.1.245',
      port: 5432,
      username: 'postgres',
      password: 'postgres',
      database: 'codepath',
      autoLoadEntities: true,
      synchronize: false,
    }),
    ChatModule,
    EmbeddingModule,
    RepoModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
