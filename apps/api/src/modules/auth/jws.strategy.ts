import { Injectable } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { GenericNullable } from '@workspace/codepath-common/globals'
import { eq } from 'drizzle-orm'
import { ExtractJwt, Strategy } from 'passport-jwt'

import { DbService } from '../db/db.service'
import { SelectUser, users } from '../db/schema'

interface JWTPayload {
  sub: number
  email: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly dbService: DbService
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

  async validate(payload: JWTPayload): Promise<GenericNullable<SelectUser>> {
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
