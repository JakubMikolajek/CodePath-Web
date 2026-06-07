import { type NextRequest, NextResponse } from 'next/server'

import { getKeycloakAccessToken } from '@/auth'

const internalApiBaseUrl = (process.env.INTERNAL_API_URL ?? process.env.INTERNAL_API_BASE_URL ?? 'http://localhost:3001/api').replace(/\/$/, '')

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardToApi(request, context)
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardToApi(request, context)
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardToApi(request, context)
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardToApi(request, context)
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return forwardToApi(request, context)
}

async function forwardToApi(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const accessToken = await getKeycloakAccessToken(request)

  if (!accessToken) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { path } = await context.params
  const targetUrl = new URL(`${internalApiBaseUrl}/${path.join('/')}`)

  targetUrl.search = request.nextUrl.search

  const headers = new Headers(request.headers)

  headers.delete('authorization')
  headers.delete('connection')
  headers.delete('content-length')
  headers.delete('cookie')
  headers.delete('host')
  headers.delete('accept-encoding')

  headers.set('authorization', `Bearer ${accessToken}`)

  const response = await fetch(targetUrl, {
    body: shouldForwardBody(request.method) ? await request.arrayBuffer() : undefined,
    headers,
    method: request.method,
    redirect: 'manual'
  })

  const responseHeaders = new Headers(response.headers)

  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')
  responseHeaders.delete('transfer-encoding')

  return new NextResponse(response.body, {
    headers: responseHeaders,
    status: response.status,
    statusText: response.statusText
  })
}

function shouldForwardBody(method: string): boolean {
  return !['GET', 'HEAD'].includes(method.toUpperCase())
}
