import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from '@nestjs/common'

import { AuthService } from '../services/auth.service'

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const token = extractAccessToken(request)

    if (!token) {
      throw new UnauthorizedException('Missing access token')
    }

    return await this.attachKeycloakUser(request, token)
  }

  private async attachKeycloakUser(request: any, token: string): Promise<boolean> {
    const user = await this.authService.validateKeycloakAccessToken(token)
    if (!user) {
      throw new UnauthorizedException('Invalid Keycloak access token')
    }
    request.user = user
    return true
  }
}

function extractAccessToken(request: any): null | string {
  if (request?.cookies?.access_token) {
    return request.cookies.access_token
  }

  const authHeader = request?.headers?.authorization
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice('bearer '.length).trim()
  }

  return null
}
