import {
  Body,
  Controller,
  Get,
  Post,
  Req, Res,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { Response } from 'express'

import { SelectUser } from '../db/schema'

import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LocalAuthGuard } from './local-auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body)
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  login(
    @Req() req: { user: SelectUser },
    @Res({ passthrough: true }) res: Response
  ) {
    const { access_token } = this.authService.login(req.user)

    res.cookie('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })

    return { message: 'logged_in' }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.cookie('access_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return { message: 'logged_out' }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  getMe(@Req() req: { user: SelectUser }) {
    const { id, email, login } = req.user

    return { id, email, login }
  }
}
