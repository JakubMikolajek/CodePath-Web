import { some } from 'lodash'
import { type NextRequest, NextResponse } from 'next/server'

function decodeJwtPayload(token: string): null | Record<string, unknown> {
  const parts = token.split('.')
  if (parts.length < 2 || !parts[1]) {
    return null
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const normalized = base64.padEnd(base64.length + (4 - (base64.length % 4 || 4)) % 4, '=')
    return JSON.parse(atob(normalized)) as Record<string, unknown>
  } catch {
    return null
  }
}

function isJwtStillValid(token: string): boolean {
  const payload = decodeJwtPayload(token)
  const exp = payload?.exp

  if (typeof exp !== 'number') {
    return false
  }

  const nowInSeconds = Math.floor(Date.now() / 1000)
  return exp > nowInSeconds
}

function redirectToLoginAndClearToken(request: NextRequest) {
  const response = NextResponse.redirect(new URL('/', request.url))
  response.cookies.set('access_token', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax'
  })
  return response
}

export function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl

  const protectedRoutes = ['/dashboard']

  const isProtectedRoute = some(protectedRoutes, route => pathname.startsWith(route))
  const hasValidToken = token ? isJwtStillValid(token) : false

  if (isProtectedRoute && !hasValidToken) {
    if (token) {
      return redirectToLoginAndClearToken(request)
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (hasValidToken && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (token && pathname === '/') {
    const response = NextResponse.next()
    response.cookies.set('access_token', '', {
      httpOnly: true,
      maxAge: 0,
      path: '/',
      sameSite: 'lax'
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)']
}
