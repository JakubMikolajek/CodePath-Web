import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Nullable } from '@workspace/codepath-common/globals'
import { eq } from 'drizzle-orm'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { env } from '../../../config/env'
import { SelectUser, users } from '../../db/schema'
import { DbService } from '../../db/services/db.service'

interface JWTPayload {
  email: string
  sub: number
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly dbService: DbService
  ) {
    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromExtractors([
        req => {
          let token = null

          if (req && req.cookies) {
            token = req.cookies['access_token']
          }

          return token
        }
      ]),
      secretOrKey: env.jwtSecret
    })
  }

  async validate(payload: JWTPayload): Promise<Nullable<SelectUser>> {
    const [user] = await this.dbService.dbClient.select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1)

    if (!user) {
      return null
    }

    return user
  }
}
