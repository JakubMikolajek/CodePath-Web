import type { JWT } from 'next-auth/jwt'
import { getToken } from 'next-auth/jwt'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth/jwt', async () => {
  const actual = await vi.importActual<typeof import('next-auth/jwt')>('next-auth/jwt')

  return {
    ...actual,
    getToken: vi.fn()
  }
})

const getTokenMock = vi.mocked(getToken)

describe('proxy auth redirects', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-27T12:00:00.000Z'))
    process.env.NEXTAUTH_SECRET = 'test-secret'
    delete process.env.AUTH_SECRET
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    delete process.env.NEXTAUTH_SECRET
  })

  it('redirects expired dashboard requests through the auth refresh route', async () => {
    getTokenMock.mockResolvedValue(expiredToken())

    const { proxy } = await import('./proxy')
    const response = await proxy(request('/dashboard?tab=repos'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/api/auth/refresh?callbackUrl=%2Fdashboard%3Ftab%3Drepos')
  })

  it('refreshes an expired root request before sending the user to the dashboard', async () => {
    getTokenMock.mockResolvedValue(expiredToken())

    const { proxy } = await import('./proxy')
    const response = await proxy(request('/'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/api/auth/refresh?callbackUrl=%2Fdashboard')
  })

  it('keeps active root requests on the existing dashboard redirect path', async () => {
    getTokenMock.mockResolvedValue({
      accessToken: 'active-access-token',
      expiresAt: Math.floor(Date.now() / 1000) + 300,
      refreshToken: 'refresh-token'
    } satisfies JWT)

    const { proxy } = await import('./proxy')
    const response = await proxy(request('/'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard')
  })
})

function request(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'http://localhost:3000'))
}

function expiredToken(): JWT {
  return {
    accessToken: 'expired-access-token',
    expiresAt: Math.floor(Date.now() / 1000) - 60,
    refreshToken: 'refresh-token'
  } satisfies JWT
}
