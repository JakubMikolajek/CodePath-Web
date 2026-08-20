import { Injectable } from '@nestjs/common'
import { Nullable } from '@workspace/codepath-common'

import { AuthService } from '../../auth/services/auth.service'
import type { SelectUser } from '../../db/schema'

interface RealtimeHandshake {
  auth?: { token?: unknown }
  headers: { authorization?: string | string[] }
}

@Injectable()
export class RealtimeAuthService {
  constructor(private readonly authService: AuthService) {}

  async authenticate(handshake: RealtimeHandshake): Promise<Nullable<SelectUser>> {
    const token = this.extractToken(handshake)

    if (!token) return null

    return await this.authService.validateKeycloakAccessToken(token)
  }

  private extractToken(handshake: RealtimeHandshake): Nullable<string> {
    if (typeof handshake.auth?.token === 'string' && handshake.auth.token.trim()) return handshake.auth.token.trim()

    const authorization = handshake.headers.authorization

    if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) return authorization.slice('bearer '.length).trim() || null

    return null
  }
}
