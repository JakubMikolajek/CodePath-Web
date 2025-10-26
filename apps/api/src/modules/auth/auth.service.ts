import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { GenericNullable } from '@workspace/codepath-common/globals'
import * as bcrypt from 'bcrypt'
import { eq, or } from 'drizzle-orm'

import { DbService } from '../db/db.service'
import { InserUser, SelectUser, users } from '../db/schema'
import { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly dbService: DbService,
  ) { }

  login(user: SelectUser) {
    const payload = { email: user.email, sub: user.id }
    return {
      access_token: this.jwtService.sign(payload)
    }
  }

  async register(body: RegisterDto) {
    const { email, login, password } = body

    const existing = await this.getUserByIdentifier(email, login)

    if (existing) {
      throw new UnauthorizedException('Email or login already in use')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await this.createUser({ email, login, passwordHash })

    return { id: user.id, login: user.login, message: 'User registered' }
  }

  async validateUser(identifier: string, password: string): Promise<GenericNullable<SelectUser>> {
    const user = await this.getUserByIdentifier(identifier, identifier)

    if (!user) {
      return null
    }

    const match = await bcrypt.compare(password, user.passwordHash)
    return match ? user : null
  }

  private async createUser(payload: InserUser): Promise<SelectUser> {
    const [createdUser] = await this.dbService.dbClient.insert(users)
      .values(payload)
      .returning()

    return createdUser
  }

  private async getUserByIdentifier(email: string, login: string): Promise<SelectUser> {
    const [user] = await this.dbService.dbClient.select()
      .from(users)
      .where(
        or(
          eq(users.email, email),
          eq(users.login, login)
        )
      ).limit(1)

    return user
  }
}
