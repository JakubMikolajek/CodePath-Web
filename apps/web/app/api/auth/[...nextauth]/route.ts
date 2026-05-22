import { authHandler } from '@/auth'

const handler = authHandler as (request: Request) => Promise<Response>

export { handler as GET, handler as POST }
