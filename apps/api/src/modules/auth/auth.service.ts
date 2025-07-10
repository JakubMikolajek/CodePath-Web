import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import * as bcrypt from 'bcrypt'
import { Repository } from 'typeorm'

import { User } from '../user/entities/user.entity'

import { RegisterDto } from './dto/register.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(identifier: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: [{ email: identifier }, { login: identifier }],
    })
    if (!user) return null
    const match = await bcrypt.compare(password, user.passwordHash)
    return match ? user : null
  }

  login(user: User) {
    const payload = { sub: user.id, email: user.email }
    return {
      access_token: this.jwtService.sign(payload),
    }
  }

  async register(body: RegisterDto) {
    const { email, login, password } = body

    const existing = await this.userRepo.findOne({
      where: [{ email }, { login }],
    })

    if (existing) {
      throw new UnauthorizedException('Email or login already in use')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = this.userRepo.create({ email, login, passwordHash })

    await this.userRepo.save(user)

    return { message: 'User registered' }
  }
}
