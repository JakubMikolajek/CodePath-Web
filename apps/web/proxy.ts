import { type NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
const secureCookie = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '').startsWith('https://')

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = authSecret ? await getToken({ req, secret: authSecret, secureCookie }) : null
  const isAuthenticated = Boolean(token)
  const isProtectedRoute = pathname.startsWith('/dashboard')

  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (isAuthenticated && pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|api/backend|_next/static|_next/image|.*\\.png$).*)']
}
