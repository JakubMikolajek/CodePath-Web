import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LoggerModule } from 'nestjs-pino'

import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './modules/auth/auth.module'
import { ChatModule } from './modules/chat/chat.module'
import { Chat } from './modules/chat/entities/chat.entity'
import { EmbeddingModule } from './modules/embedding/embedding.module'
import { Embedding } from './modules/embedding/entities/embedding.entity'
import { File } from './modules/repos/entities/file.entity'
import { Repo } from './modules/repos/entities/repo.entity'
import { RepoModule } from './modules/repos/repo.module'
import { User } from './modules/user/entities/user.entity'
import { UserModule } from './modules/user/user.module'

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
      entities: [Chat, User, Repo, Embedding, File],
      synchronize: false,
    }),
    ChatModule,
    EmbeddingModule,
    RepoModule,
    UserModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
