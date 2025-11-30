import compress from '@fastify/compress'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({
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
  }))

  app.use(bodyParser.json({ limit: '50mb' }))
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
  app.use(cookieParser())

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true
    }),
  )

  app.setGlobalPrefix('api')

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false
  })

  await app.register(compress)

  await app.register(cors, {
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    origin: '*'
  })

  app.enableShutdownHooks()

  const config = new DocumentBuilder().setTitle('CodePath').build()
  const document = SwaggerModule.createDocument(app, config)

  SwaggerModule.setup('api/docs', app, document)

  await app.listen(process.env.PORT ?? 3001)
}
bootstrap()
