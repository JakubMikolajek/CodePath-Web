import { type NextRequest, NextResponse } from 'next/server'

import { getKeycloakAccessToken } from '@/auth'

export async function GET(request: NextRequest) {
  const token = await getKeycloakAccessToken(request)

  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ token })
}
