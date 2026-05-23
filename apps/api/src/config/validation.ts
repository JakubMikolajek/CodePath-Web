import { ValidationPipe } from '@nestjs/common'

export function createApiValidationPipe() {
  return new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true
  })
}
