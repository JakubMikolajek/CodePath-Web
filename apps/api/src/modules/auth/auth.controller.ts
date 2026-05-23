import { Controller, Get, Req, UseGuards } from '@nestjs/common'

import { SelectUser } from '../db/schema'
import { SessionAuthGuard } from './guards/session-auth.guard'

@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SessionAuthGuard)
  getMe(@Req() req: { user: SelectUser }) {
    const { email, id, login } = req.user

    return { email, id, login }
  }
}
