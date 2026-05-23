import { authHandler } from '@/auth'

interface NextRouteContext {
  params: Promise<{ nextauth: string[] }>
}

interface NextAuthRouteContext {
  params: { nextauth: string[] }
}

const handler = authHandler as (request: Request, context: NextAuthRouteContext) => Promise<Response>

async function handleAuthRequest(request: Request, context: NextRouteContext) {
  const url = new URL(request.url)
  console.info(`[next-auth-route] ${request.method} ${url.pathname}${url.search}`)
  const params = await context.params

  return handler(request, { params })
}

export { handleAuthRequest as GET, handleAuthRequest as POST }
