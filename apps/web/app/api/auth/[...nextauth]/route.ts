import { authHandler } from '@/auth'

const handler = authHandler as (request: Request) => Promise<Response>

function handleAuthRequest(request: Request) {
  const url = new URL(request.url)
  console.info(`[next-auth-route] ${request.method} ${url.pathname}${url.search}`)

  return handler(request)
}

export { handleAuthRequest as GET, handleAuthRequest as POST }
