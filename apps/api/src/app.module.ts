import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LoggerModule } from 'nestjs-pino'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { Chat } from './modules/chat/chat.entity'
import { ChatModule } from './modules/chat/chat.module'
import { Embedding } from './modules/embedding/embedding.entity'
import { EmbeddingModule } from './modules/embedding/embedding.module'

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
      entities: [Embedding, Chat],
      synchronize: false,
    }),
    ChatModule,
    EmbeddingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
