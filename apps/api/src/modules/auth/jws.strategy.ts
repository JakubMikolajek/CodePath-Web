import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { InjectRepository } from '@nestjs/typeorm'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { Repository } from 'typeorm'

import { User } from '../user/entities/user.entity'

interface JWTPayload {
  sub: number
  email: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => {
          let token = null

          if (req && req.cookies) {
            token = req.cookies['access_token']
          }

          return token
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: 'supersecret',
    })
  }

  async validate(payload: JWTPayload) {
    const user = await this.userRepo.findOneBy({ id: payload.sub })

    if (!user) {
      return null
    }

    return user
  }
}
