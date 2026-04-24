import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { env } from '../../config/env'
import { AuthController } from './auth.controller'
import { SessionAuthGuard } from './guards/session-auth.guard'
import { AuthService } from './services/auth.service'

@Module({
  controllers: [AuthController],
  exports: [
    AuthService,
    SessionAuthGuard
  ],
  imports: [JwtModule.register({
    secret: env.jwtSecret,
    signOptions: { expiresIn: env.jwtExpiresInSeconds }
  })],
  providers: [
    AuthService,
    SessionAuthGuard
  ]
})
export class AuthModule { }
