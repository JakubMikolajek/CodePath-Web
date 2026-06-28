import { type NextRequest, NextResponse } from 'next/server'

import { authHandler } from '@/auth'

interface NextAuthRouteContext {
  params: { nextauth: string[] }
}

type NextAuthRouteHandler = (request: Request, context: NextAuthRouteContext) => Promise<Response>

const sessionHandler = authHandler as NextAuthRouteHandler

export async function GET(request: NextRequest) {
  const sessionResponse = await sessionHandler(request, { params: { nextauth: ['session'] } })
  const callbackUrl = resolveCallbackUrl(request)
  const response = NextResponse.redirect(callbackUrl)

  for (const cookie of getSetCookieHeaders(sessionResponse.headers)) {
    response.headers.append('set-cookie', cookie)
  }

  return response
}

function resolveCallbackUrl(request: NextRequest): URL {
  const rawCallbackUrl = request.nextUrl.searchParams.get('callbackUrl') ?? '/dashboard'

  try {
    const callbackUrl = new URL(rawCallbackUrl, request.nextUrl.origin)

    if (callbackUrl.origin === request.nextUrl.origin) return callbackUrl
  } catch {
    // Fall through to the default safe callback URL.
  }

  return new URL('/dashboard', request.nextUrl.origin)
}

export function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie

  if (getSetCookie) return getSetCookie.call(headers).flatMap(splitCombinedSetCookieHeader)

  const setCookie = headers.get('set-cookie')

  return setCookie ? splitCombinedSetCookieHeader(setCookie) : []
}

function splitCombinedSetCookieHeader(header: string): string[] {
  return header.split(/,(?=\s*[^;,\s]+=)/).map(cookie => cookie.trim()).filter(Boolean)
}
