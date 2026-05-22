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
  debug: true,
  secret: authSecret,
  callbacks: {
    async jwt({ account, token }) {
      if (account) {
        console.info(`[next-auth] jwt account provider=${account.provider} type=${account.type} expires_at=${account.expires_at ?? 'none'} has_access_token=${Boolean(account.access_token)}`)
        token.accessToken = account.access_token
        token.expiresAt = account.expires_at
        token.idToken = account.id_token
        token.refreshToken = account.refresh_token
        return token
      }

      if (typeof token.expiresAt === 'number' && Date.now() < token.expiresAt * 1000 - 30_000) {
        return token
      }

      return await refreshAccessToken(token)
    },
    redirect({ baseUrl, url }) {
      console.info(`[next-auth] redirect url=${url} baseUrl=${baseUrl}`)

      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }

      if (new URL(url).origin === baseUrl) {
        return url
      }

      return baseUrl
    },
    session({ session, token }) {
      session.error = typeof token.error === 'string' ? token.error : undefined

      if (session.user) {
        session.user.subject = typeof token.sub === 'string' ? token.sub : undefined
      }

      return session
    },
    signIn({ account, profile }) {
      console.info(`[next-auth] signIn provider=${account?.provider ?? 'unknown'} subject=${profile?.sub ?? 'unknown'} email=${profile?.email ?? 'unknown'}`)

      return true
    }
  },
  events: {
    signIn({ account, isNewUser, user }) {
      console.info(`[next-auth] event=signIn provider=${account?.provider ?? 'unknown'} user=${user.email ?? user.id ?? 'unknown'} isNewUser=${Boolean(isNewUser)}`)
    },
    signOut() {
      console.info('[next-auth] event=signOut')
    }
  },
  logger: {
    debug(code, metadata) {
      console.info(`[next-auth][debug][${code}]`, sanitizeAuthLogMetadata(metadata))
    },
    error(code, metadata) {
      console.error(`[next-auth][error][${code}]`, sanitizeAuthLogMetadata(metadata))
    },
    warn(code) {
      console.warn(`[next-auth][warn][${code}]`)
    }
  },
  providers: [
    Keycloak({
      clientId: keycloakClientId,
      clientSecret: keycloakClientSecret,
      issuer: normalizedKeycloakIssuer,
      authorization: {
        params: {
          scope: 'openid profile email'
        }
      }
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
  return await readKeycloakAccessToken({ headers: { cookie: cookieHeader } } as GetTokenRequest)
}

async function readKeycloakAccessToken(request: GetTokenRequest): Promise<null | string> {
  if (!authSecret) {
    return null
  }

  const token = await getToken({ req: request, secret: authSecret, secureCookie })

  return typeof token?.accessToken === 'string' ? token.accessToken : null
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  const refreshToken = typeof token.refreshToken === 'string' ? token.refreshToken : null

  if (!refreshToken) {
    return { ...token, error: 'RefreshAccessTokenError' }
  }

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

    if (!response.ok || !refreshed.access_token) {
      console.warn(`[next-auth] refreshAccessToken failed status=${response.status}`)
      return { ...token, error: 'RefreshAccessTokenError' }
    }

    return {
      ...token,
      accessToken: refreshed.access_token,
      error: undefined,
      expiresAt: Math.floor(Date.now() / 1000 + (refreshed.expires_in ?? 300)),
      idToken: refreshed.id_token ?? token.idToken,
      refreshToken: refreshed.refresh_token ?? refreshToken
    }
  } catch (error) {
    console.warn(`[next-auth] refreshAccessToken threw error=${error instanceof Error ? error.message : 'unknown'}`)
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

function sanitizeAuthLogMetadata(value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value
  }

  return JSON.parse(JSON.stringify(value, (key, nestedValue) => {
    if (['access_token', 'client_secret', 'id_token', 'refresh_token', 'token'].includes(key.toLowerCase())) {
      return '[redacted]'
    }

    return nestedValue
  })) as unknown
}
