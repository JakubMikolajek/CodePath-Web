import {
  createPublicKey,
  createVerify,
  type JsonWebKey,
  type KeyObject,
  randomUUID
} from 'node:crypto'

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common/globals'
import axios from 'axios'
import * as bcrypt from 'bcrypt'
import { eq, or } from 'drizzle-orm'

import { env } from '../../../config/env'
import { InserUser, SelectUser, users } from '../../db/schema'
import { DbService } from '../../db/services/db.service'

const JWT_ALGORITHM = 'RS256'

interface KeycloakJwk {
  alg?: string
  kid: string
  kty: string
  use?: string
}

interface KeycloakJwksResponse {
  keys?: KeycloakJwk[]
}

interface JwtHeader {
  alg?: string
  kid?: string
}

interface KeycloakClaims {
  aud?: string | string[]
  azp?: string
  email?: string
  email_verified?: boolean
  exp?: number
  iss?: string
  preferred_username?: string
  sub?: string
}

@Injectable()
export class AuthService {
  private jwksCache: Nullable<{ expiresAt: number, keys: KeycloakJwk[] }> = null
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly dbService: DbService,
  ) { }

  async validateKeycloakAccessToken(accessToken: string): Promise<Nullable<SelectUser>> {
    try {
      const claims = await this.verifyKeycloakJwt(accessToken)

      if (claims.email_verified !== true) return null

      return await this.findOrCreateExternalUser({
        email: claims.email,
        login: claims.preferred_username,
        subject: claims.sub
      })
    } catch (error) {
      this.logger.warn(`Keycloak token validation failed: ${error instanceof Error ? error.message : 'unknown error'}`)
      return null
    }
  }

  private async createUser(payload: InserUser): Promise<SelectUser> {
    const [createdUser] = await this.dbService.dbClient.insert(users).values(payload).returning()

    return createdUser
  }

  private async fetchKeycloakJwks(): Promise<KeycloakJwk[]> {
    const now = Date.now()

    if (this.jwksCache && this.jwksCache.expiresAt > now) return this.jwksCache.keys

    const { data } = await axios.get<KeycloakJwksResponse>(this.keycloakJwksUrl(), { timeout: 10_000 })
    const keys = data.keys ?? []

    this.jwksCache = { expiresAt: now + 10 * 60 * 1000, keys }

    return keys
  }

  private async findOrCreateExternalUser(identity: {
    email?: string
    login?: string
    subject?: string
  }): Promise<SelectUser> {
    if (!identity.subject) throw new UnauthorizedException('Missing Keycloak subject')

    const normalizedEmail = identity.email?.trim().toLowerCase()

    if (!normalizedEmail) throw new UnauthorizedException('Missing Keycloak email')

    const normalizedLogin = identity.login?.trim() || normalizedEmail.split('@')[0] || `kc-${Date.now()}`

    const [existingUser] = await this.dbService.dbClient.select().from(users)
      .where(or(eq(users.authSubject, identity.subject), eq(users.email, normalizedEmail)))
      .limit(1)

    if (existingUser) {
      if (existingUser.authProvider === 'keycloak' && existingUser.authSubject === identity.subject) return existingUser

      const [updatedUser] = await this.dbService.dbClient.update(users)
        .set({ authProvider: 'keycloak', authSubject: identity.subject, email: normalizedEmail, login: normalizedLogin })
        .where(eq(users.id, existingUser.id))
        .returning()

      return updatedUser
    }

    return await this.createUser({
      authProvider: 'keycloak',
      authSubject: identity.subject,
      email: normalizedEmail,
      login: normalizedLogin,
      passwordHash: await bcrypt.hash(`keycloak-${randomUUID()}`, 10)
    })
  }

  private isExpectedAudience(claims: KeycloakClaims): boolean {
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud].filter((audience): audience is string => Boolean(audience))
    const allowedAudiences = new Set([env.keycloakClientId, ...env.keycloakAllowedAudiences])

    return audiences.some(audience => allowedAudiences.has(audience)) || Boolean(claims.azp && allowedAudiences.has(claims.azp))
  }

  private keycloakJwksUrl() {
    return `${env.keycloakIssuer.replace(/\/+$/, '')}/protocol/openid-connect/certs`
  }

  private async resolveKeyObject(header: JwtHeader): Promise<KeyObject> {
    if (!header.kid) throw new UnauthorizedException('Missing token key id')

    const jwks = await this.fetchKeycloakJwks()
    const jwk = jwks.find(item => item.kid === header.kid)

    if (!jwk) {
      this.jwksCache = null
      const refreshedJwks = await this.fetchKeycloakJwks()
      const refreshedJwk = refreshedJwks.find(item => item.kid === header.kid)

      if (!refreshedJwk) throw new UnauthorizedException('Unknown token key id')

      return createPublicKey({ format: 'jwk', key: refreshedJwk as unknown as JsonWebKey })
    }

    return createPublicKey({ format: 'jwk', key: jwk as unknown as JsonWebKey })
  }

  private async verifyKeycloakJwt(token: string): Promise<KeycloakClaims> {
    const parts = token.split('.')

    if (parts.length !== 3) throw new UnauthorizedException('Invalid token format')

    const [encodedHeader, encodedPayload, encodedSignature] = parts
    const header = decodeJwtPart<JwtHeader>(encodedHeader)
    const claims = decodeJwtPart<KeycloakClaims>(encodedPayload)

    if (header.alg !== JWT_ALGORITHM) throw new UnauthorizedException('Unsupported token algorithm')

    const key = await this.resolveKeyObject(header)
    const verifier = createVerify('RSA-SHA256')
    verifier.update(`${encodedHeader}.${encodedPayload}`)
    verifier.end()

    const validSignature = verifier.verify(key, base64UrlDecode(encodedSignature))

    if (!validSignature) throw new UnauthorizedException('Invalid token signature')

    const nowInSeconds = Math.floor(Date.now() / 1000)

    if (!claims.exp || claims.exp <= nowInSeconds) throw new UnauthorizedException('Token expired')
    if (claims.iss !== env.keycloakIssuer.replace(/\/+$/, '')) throw new UnauthorizedException('Invalid token issuer')
    if (!this.isExpectedAudience(claims)) throw new UnauthorizedException('Invalid token audience')

    return claims
  }
}

function base64UrlDecode(value: string): Buffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const normalized = base64.padEnd(base64.length + (4 - (base64.length % 4 || 4)) % 4, '=')
  return Buffer.from(normalized, 'base64')
}

function decodeJwtPart<T>(value: string): T {
  try {
    return JSON.parse(base64UrlDecode(value).toString('utf8')) as T
  } catch {
    throw new UnauthorizedException('Invalid token payload')
  }
}
