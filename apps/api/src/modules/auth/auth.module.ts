import { Module } from '@nestjs/common'

import { AuthController } from './auth.controller'
import { SessionAuthGuard } from './guards/session-auth.guard'
import { AuthService } from './services/auth.service'

@Module({
  controllers: [AuthController],
  exports: [
    AuthService,
    SessionAuthGuard
  ],
  providers: [
    AuthService,
    SessionAuthGuard
  ]
})
export class AuthModule { }
