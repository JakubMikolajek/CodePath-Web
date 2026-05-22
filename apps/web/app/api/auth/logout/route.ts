import { type NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
const keycloakClientId = process.env.AUTH_KEYCLOAK_ID ?? process.env.KEYCLOAK_CLIENT_ID ?? 'codepath-web'
const keycloakIssuer = (process.env.AUTH_KEYCLOAK_ISSUER ?? process.env.KEYCLOAK_ISSUER ?? '').replace(/\/+$/, '')
const secureCookie = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '').startsWith('https://')

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin
  const token = authSecret ? await getToken({ req: request, secret: authSecret, secureCookie }) : null
  const idToken = typeof token?.idToken === 'string' ? token.idToken : null
  const response = NextResponse.redirect(buildLogoutUrl(origin, idToken))

  clearNextAuthCookies(request, response)

  return response
}

function buildLogoutUrl(origin: string, idToken: null | string): string {
  if (!keycloakIssuer) {
    return origin
  }

  const postLogoutRedirectUri = `${origin}/`
  const logoutUrl = new URL(`${keycloakIssuer}/protocol/openid-connect/logout`)
  logoutUrl.searchParams.set('client_id', keycloakClientId)
  logoutUrl.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)

  if (idToken) {
    logoutUrl.searchParams.set('id_token_hint', idToken)
  }

  console.info(`[next-auth] keycloak logout post_logout_redirect_uri=${postLogoutRedirectUri} client_id=${keycloakClientId} has_id_token_hint=${Boolean(idToken)}`)

  return logoutUrl.toString()
}

function clearNextAuthCookies(request: NextRequest, response: NextResponse): void {
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith('next-auth.') ||
      cookie.name.startsWith('__Secure-next-auth.') ||
      cookie.name.startsWith('__Host-next-auth.')
    ) {
      response.cookies.set(cookie.name, '', {
        expires: new Date(0),
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: secureCookie
      })
    }
  }
}
