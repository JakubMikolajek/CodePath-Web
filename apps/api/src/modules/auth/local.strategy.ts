import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-local'

import { SelectUser } from '../db/schema'
import { AuthService } from './auth.service'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({ usernameField: 'identifier' })
  }

  async validate(identifier: string, password: string): Promise<SelectUser> {
    const user = await this.authService.validateUser(identifier, password)

    if (!user) {
      throw new UnauthorizedException()
    }

    return user
  }
}
