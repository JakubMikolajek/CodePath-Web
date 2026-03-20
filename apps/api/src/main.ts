import compress from '@fastify/compress'
import fastifyCookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { AppModule } from './app.module'
import { env, resolveCorsOrigin } from './config/env'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        transport: {
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'SYS:standard'
          },
          target: 'pino-pretty'
        }
      }
    })
  )

  app.setGlobalPrefix('api')

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true
    }),
  )

  await app.register(fastifyCookie)

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
  })

  await app.register(compress)

  await app.register(cors, {
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    origin: resolveCorsOrigin()
  })

  app.enableShutdownHooks()

  const config = new DocumentBuilder().setTitle('CodePath').build()
  const document = SwaggerModule.createDocument(app, config)

  SwaggerModule.setup('api/docs', app, document)

  await app.listen(env.port)
}
bootstrap()
