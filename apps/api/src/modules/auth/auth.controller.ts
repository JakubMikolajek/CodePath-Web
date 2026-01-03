import {
  Body,
  Controller,
  Get, Logger,
  Post,
  Req, Res,
  UseGuards
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { FastifyReply } from 'fastify'

import { SelectUser } from '../db/schema'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LocalAuthGuard } from './local-auth.guard'

const logger = new Logger('AUTH')

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: { user: SelectUser }) {
    const { email, id, login } = req.user

    return { email, id, login }
  }

  @Post('login')
  @UseGuards(LocalAuthGuard)
  login(
    @Req() req: { user: SelectUser },
    @Res({ passthrough: true }) res: FastifyReply
  ) {
    const { access_token } = this.authService.login(req.user)

    res.cookie('access_token', access_token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })

    return { message: 'logged_in' }
  }

  @Get('logout')
  @UseGuards(AuthGuard('jwt'))
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
