import { type DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    error?: string
    user?: DefaultSession['user'] & {
      subject?: string
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string
    error?: string
    expiresAt?: number
    idToken?: string
    refreshToken?: string
  }
}
