import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

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
