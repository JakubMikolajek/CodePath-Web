import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'
import { Nullable, Undefinable } from '@workspace/codepath-common'

import { SelectUser } from '../../db/schema'
import { AuthService } from '../services/auth.service'

interface AuthenticatedRequest {
  headers: Record<string, Undefinable<string | string[]>>
  user?: SelectUser
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = extractAccessToken(request)

    // TODO: ADD CUSTOM ERROR HANDLING WITH CODE AND STATUS FROM ENUM
    if (!token) throw new UnauthorizedException('Missing access token')

    return await this.attachKeycloakUser(request, token)
  }

  private async attachKeycloakUser(request: AuthenticatedRequest, token: string): Promise<boolean> {
    const user = await this.authService.validateKeycloakAccessToken(token)

    // TODO: ADD CUSTOM ERROR HANDLING WITH CODE AND STATUS FROM ENUM
    if (!user) throw new UnauthorizedException('Invalid Keycloak access token')

    request.user = user
    return true
  }
}

function extractAccessToken(request: AuthenticatedRequest): Nullable<string> {
  const authHeader = request.headers.authorization

  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) return authHeader.slice('bearer '.length).trim()

  return null
}
