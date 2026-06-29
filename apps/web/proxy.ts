import { type NextRequest, NextResponse } from 'next/server'
import { getToken, type JWT } from 'next-auth/jwt'

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
const secureCookie = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '').startsWith('https://')
const refreshWindowMs = 30_000

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = authSecret ? await getToken({ req, secret: authSecret, secureCookie }) : null

  const isAuthenticated = Boolean(token) && !token?.error
  const isProtectedRoute = pathname.startsWith('/dashboard')

  if (isAuthenticated && isAccessTokenRefreshDue(token)) {
    return NextResponse.redirect(buildRefreshUrl(req, pathname === '/' ? '/dashboard' : `${pathname}${req.nextUrl.search}`))
  }

  if (pathname === '/' && isAuthenticated) return NextResponse.redirect(new URL('/dashboard', req.url))

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname + (req.nextUrl.search || ''))
    const response = NextResponse.redirect(loginUrl)

    if (token?.error) {
      for (const cookie of req.cookies.getAll()) {
        if (
          cookie.name.startsWith('next-auth.')
          || cookie.name.startsWith('__Secure-next-auth.')
          || cookie.name.startsWith('__Host-next-auth.')
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

    return response
  }

  return NextResponse.next()
}

export function isAccessTokenRefreshDue(token: JWT | null): boolean {
  if (typeof token?.expiresAt !== 'number') return false

  return Date.now() >= token.expiresAt * 1000 - refreshWindowMs
}

function buildRefreshUrl(req: NextRequest, callbackUrl: string): URL {
  const refreshUrl = new URL('/api/auth/refresh', req.url)

  refreshUrl.searchParams.set('callbackUrl', callbackUrl)

  return refreshUrl
}

export const config = {
  matcher: ['/((?!api/auth|api/backend|_next/static|_next/image|.*\\.png$).*)']
}
