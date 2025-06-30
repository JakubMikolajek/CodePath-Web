import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

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

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Req() req: { user: User }) {
    const { id, email, login } = req.user
    return { id, email, login }
  }
}
