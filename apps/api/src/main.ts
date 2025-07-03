import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as bodyParser from 'body-parser'
import cookieParser from 'cookie-parser'
import { Logger } from 'nestjs-pino'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.use(bodyParser.json({ limit: '50mb' }))
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))
  app.use(cookieParser())

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  )

  app.setGlobalPrefix('api')
  app.useLogger(app.get(Logger))

  const config = new DocumentBuilder().setTitle('CodePath').build()
  const document = SwaggerModule.createDocument(app, config)

  SwaggerModule.setup('api/docs', app, document)

  await app.listen(process.env.PORT ?? 3001)
}
bootstrap()
