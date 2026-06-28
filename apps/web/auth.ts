import type { NextRequest } from 'next/server'
import NextAuth, { type NextAuthOptions } from 'next-auth'
import { getToken, type JWT } from 'next-auth/jwt'
import Keycloak from 'next-auth/providers/keycloak'

const keycloakIssuer = process.env.AUTH_KEYCLOAK_ISSUER ?? process.env.KEYCLOAK_ISSUER ?? 'http://127.0.0.1:8081/realms/codepath-local'
const normalizedKeycloakIssuer = keycloakIssuer.replace(/\/+$/, '')

const keycloakClientId = process.env.AUTH_KEYCLOAK_ID ?? process.env.KEYCLOAK_CLIENT_ID ?? 'codepath-web'

const keycloakClientSecret = process.env.AUTH_KEYCLOAK_SECRET ?? process.env.KEYCLOAK_CLIENT_SECRET ?? ''
const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
const secureCookie = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '').startsWith('https://')

type GetTokenRequest = Parameters<typeof getToken>[0]['req']

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  callbacks: {
    async jwt({ account, token }) {
      if (account) {
        token.accessToken = account.access_token
        token.expiresAt = account.expires_at
        token.idToken = account.id_token
        token.refreshToken = account.refresh_token
        return token
      }

      if (typeof token.expiresAt === 'number' && Date.now() < token.expiresAt * 1000 - 30_000) return token

      return await refreshAccessToken(token)
    },
    redirect({ baseUrl, url }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url

      return baseUrl
    },
    session({ session, token }) {
      session.error = typeof token.error === 'string' ? token.error : undefined

      if (session.user) session.user.subject = typeof token.sub === 'string' ? token.sub : undefined

      return session
    }
  },
  providers: [
    Keycloak({
      authorization: { params: { scope: 'openid profile email' } },
      clientId: keycloakClientId,
      clientSecret: keycloakClientSecret,
      issuer: normalizedKeycloakIssuer
    })
  ],
  session: {
    strategy: 'jwt'
  }
}

export const authHandler = NextAuth(authOptions)

export async function getKeycloakAccessToken(request: NextRequest): Promise<null | string> {
  return await readKeycloakAccessToken(request)
}

export async function getKeycloakAccessTokenFromCookieHeader(cookieHeader: string): Promise<null | string> {
  return await readKeycloakAccessToken({
    cookies: parseCookieHeader(cookieHeader),
    headers: { cookie: cookieHeader }
  } as GetTokenRequest)
}

async function readKeycloakAccessToken(request: GetTokenRequest): Promise<null | string> {
  if (!authSecret) return null

  const token = await getToken({ req: request, secret: authSecret, secureCookie })

  return typeof token?.accessToken === 'string' ? token.accessToken : null
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(';').map(part => part.trim()).filter(Boolean).reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf('=')

    if (separatorIndex <= 0) return cookies

    const name = part.slice(0, separatorIndex).trim()
    const rawValue = part.slice(separatorIndex + 1).trim()

    if (!name) return cookies

    try {
      cookies[name] = decodeURIComponent(rawValue)
    } catch {
      cookies[name] = rawValue
    }

    return cookies
  }, {})
}

const refreshInFlight = new Map<string, Promise<JWT>>()

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const refreshToken = typeof token.refreshToken === 'string' ? token.refreshToken : null

  if (!refreshToken) return { ...token, error: 'RefreshAccessTokenError' }

  const inflight = refreshInFlight.get(refreshToken)

  if (inflight) return inflight

  const promise = doRefreshAccessToken(token, refreshToken).finally(() => {
    refreshInFlight.delete(refreshToken)
  })

  refreshInFlight.set(refreshToken, promise)
  return promise
}

async function doRefreshAccessToken(token: JWT, refreshToken: string): Promise<JWT> {
  try {
    const response = await fetch(`${normalizedKeycloakIssuer}/protocol/openid-connect/token`, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      body: new URLSearchParams({
        client_id: keycloakClientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        ...(keycloakClientSecret ? { client_secret: keycloakClientSecret } : {})
      })
    })

    const refreshed = await response.json() as {
      access_token?: string
      expires_in?: number
      id_token?: string
      refresh_token?: string
    }

    if (!response.ok || !refreshed.access_token) return { ...token, error: 'RefreshAccessTokenError' }

    return {
      ...token,
      accessToken: refreshed.access_token,
      error: undefined,
      expiresAt: Math.floor(Date.now() / 1000 + (refreshed.expires_in ?? 300)),
      idToken: refreshed.id_token ?? token.idToken,
      refreshToken: refreshed.refresh_token ?? refreshToken
    }
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}
