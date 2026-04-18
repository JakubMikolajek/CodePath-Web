import { randomUUID } from 'node:crypto'
import { URLSearchParams } from 'node:url'

import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common/globals'
import axios from 'axios'
import * as bcrypt from 'bcrypt'
import { eq, or } from 'drizzle-orm'

import { env } from '../../config/env'
import { DbService } from '../db/db.service'
import { InserUser, SelectUser, users } from '../db/schema'
import { RegisterDto } from './dto/register.dto'

interface KeycloakTokenResponse {
  access_token: string
  expires_in?: number
}

interface KeycloakUserInfo {
  email?: string
  preferred_username?: string
  sub?: string
}

@Injectable()
export class AuthService {
  constructor(
    private readonly dbService: DbService,
  ) { }

  async loginWithCredentials(identifier: string, password: string): Promise<{ access_token: string, expires_in?: number }> {
    return await this.loginWithKeycloak(identifier, password)
  }

  async register(body: RegisterDto) {
    const { email, login, password } = body

    const normalizedEmail = email.trim().toLowerCase()
    const normalizedLogin = login.trim()
    const existing = await this.getUserByIdentifier(normalizedEmail, normalizedLogin)

    if (existing) {
      throw new BadRequestException('Email or login already in use')
    }

    await this.createKeycloakUser({
      email: normalizedEmail,
      login: normalizedLogin,
      password
    })
    const user = await this.findOrCreateExternalUser({
      email: normalizedEmail,
      login: normalizedLogin
    })

    return { id: user.id, login: user.login, message: 'User registered' }
  }

  async validateKeycloakAccessToken(accessToken: string): Promise<Nullable<SelectUser>> {
    try {
      const { data } = await axios.get<KeycloakUserInfo>(this.keycloakUserInfoUrl(), {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        timeout: 10_000
      })

      if (!data?.email) {
        return null
      }

      return await this.findOrCreateExternalUser({
        email: data.email,
        login: data.preferred_username ?? data.email.split('@')[0]
      })
    } catch {
      return null
    }
  }

  async validateUser(identifier: string, password: string): Promise<Nullable<SelectUser>> {
    const user = await this.getUserByIdentifier(identifier, identifier)

    if (!user) {
      return null
    }

    try {
      const match = await bcrypt.compare(password, user.passwordHash)
      return match ? user : null
    } catch {
      return null
    }
  }

  private async createKeycloakUser(payload: { email: string, login: string, password: string }): Promise<void> {
    const adminAccessToken = await this.getKeycloakAdminAccessToken()

    try {
      await axios.post(
        this.keycloakAdminUsersUrl(),
        {
          credentials: [
            {
              temporary: false,
              type: 'password',
              value: payload.password
            }
          ],
          email: payload.email,
          emailVerified: true,
          enabled: true,
          username: payload.login
        },
        {
          headers: {
            Authorization: `Bearer ${adminAccessToken}`,
            'content-type': 'application/json'
          },
          timeout: 10_000
        }
      )
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        throw new BadRequestException('Email or login already in use')
      }
      throw new BadRequestException('Registration failed')
    }
  }

  private async createUser(payload: InserUser): Promise<SelectUser> {
    const [createdUser] = await this.dbService.dbClient.insert(users)
      .values(payload)
      .returning()

    return createdUser
  }

  private async findOrCreateExternalUser(identity: { email: string, login: string }): Promise<SelectUser> {
    const normalizedEmail = identity.email.trim().toLowerCase()
    const normalizedLogin = identity.login.trim() || normalizedEmail.split('@')[0] || `kc-${Date.now()}`

    const [existingUser] = await this.dbService.dbClient.select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (existingUser) {
      return existingUser
    }

    return await this.createUser({
      email: normalizedEmail,
      login: normalizedLogin,
      passwordHash: await bcrypt.hash(`keycloak-${randomUUID()}`, 10)
    })
  }

  private async getKeycloakAdminAccessToken(): Promise<string> {
    try {
      const form = new URLSearchParams({
        client_id: env.keycloakAdminClientId,
        grant_type: 'password',
        password: env.keycloakAdminPassword,
        username: env.keycloakAdminUsername
      })

      const { data } = await axios.post<KeycloakTokenResponse>(this.keycloakAdminTokenUrl(), form.toString(), {
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        timeout: 10_000
      })

      if (!data?.access_token) {
        throw new UnauthorizedException('Unable to acquire Keycloak admin access token')
      }

      return data.access_token
    } catch {
      throw new UnauthorizedException('Unable to acquire Keycloak admin access token')
    }
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

  private keycloakAdminTokenUrl() {
    const baseUrl = env.keycloakBaseUrl.replace(/\/+$/, '')
    return `${baseUrl}/realms/${env.keycloakAdminRealm}/protocol/openid-connect/token`
  }

  private keycloakAdminUsersUrl() {
    const baseUrl = env.keycloakBaseUrl.replace(/\/+$/, '')
    return `${baseUrl}/admin/realms/${env.keycloakRealm}/users`
  }

  private keycloakRealmUrl() {
    const baseUrl = env.keycloakBaseUrl.replace(/\/+$/, '')
    return `${baseUrl}/realms/${env.keycloakRealm}`
  }

  private keycloakTokenUrl() {
    return `${this.keycloakRealmUrl()}/protocol/openid-connect/token`
  }

  private keycloakUserInfoUrl() {
    return `${this.keycloakRealmUrl()}/protocol/openid-connect/userinfo`
  }

  private async loginWithKeycloak(identifier: string, password: string): Promise<{ access_token: string, expires_in?: number }> {
    try {
      const form = new URLSearchParams({
        client_id: env.keycloakClientId,
        grant_type: 'password',
        password,
        scope: 'openid profile email',
        username: identifier
      })

      if (env.keycloakClientSecret) {
        form.set('client_secret', env.keycloakClientSecret)
      }

      const { data } = await axios.post<KeycloakTokenResponse>(this.keycloakTokenUrl(), form.toString(), {
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        timeout: 10_000
      })

      if (!data?.access_token) {
        throw new UnauthorizedException('Invalid credentials')
      }

      const user = await this.validateKeycloakAccessToken(data.access_token)
      if (!user) {
        throw new UnauthorizedException('Unable to resolve Keycloak user profile')
      }

      return {
        access_token: data.access_token,
        expires_in: data.expires_in
      }
    } catch {
      throw new UnauthorizedException('Invalid credentials')
    }
  }
}
