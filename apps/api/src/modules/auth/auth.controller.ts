import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'

import { User } from '../user/entities/user.entity'

import { AuthService } from './auth.service'
import { LocalAuthGuard } from './local-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() body: { email: string, login: string, password: string }) {
    return this.authService.register(body.email, body.login, body.password)
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(@Req() req: { user: User }) {
    return this.authService.login(req.user)
  }
}
