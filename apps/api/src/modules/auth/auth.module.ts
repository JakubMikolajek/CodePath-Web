import { Module } from '@nestjs/common'

import { HttpClientModule } from '../http-client/http-client.module'
import { AuthController } from './auth.controller'
import { SessionAuthGuard } from './guards/session-auth.guard'
import { AuthService } from './services/auth.service'

@Module({
  controllers: [AuthController],
  imports: [HttpClientModule],
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
