import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common'
import { FastifyReply } from 'fastify'

import { SelectUser } from '../db/schema'
import { AuthService } from './auth.service'
import { LoginDto } from './dto/login.dto'
import { RegisterDto } from './dto/register.dto'
import { SessionAuthGuard } from './session-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  getMe(@Req() req: { user: SelectUser }) {
    const { email, id, login } = req.user

    return { email, id, login }
  }

  @Post('login')
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: FastifyReply
  ) {
    const { access_token, expires_in } = await this.authService.loginWithCredentials(
      body.identifier,
      body.password
    )
    const maxAgeInSeconds = expires_in ?? 7 * 24 * 60 * 60

    res.cookie('access_token', access_token, {
      httpOnly: true,
      maxAge: maxAgeInSeconds,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })

    return { message: 'logged_in' }
  }

  @Get('logout')
  @UseGuards(SessionAuthGuard)
  logout(@Res({ passthrough: true }) res: FastifyReply) {
    res.cookie('access_token', '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })

    return { message: 'logged_out' }
  }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body)
  }
}
