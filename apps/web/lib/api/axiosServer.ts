import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { getKeycloakAccessTokenFromCookieHeader } from '@/auth'
import { isUnauthorizedError, toError } from '@/lib/api/error'

const internalApiBaseUrl = (process.env.INTERNAL_API_URL ?? process.env.INTERNAL_API_BASE_URL ?? 'http://localhost:3001/api').replace(/\/$/, '')

export const createAxiosServer = async (): Promise<AxiosInstance> => {
  const cookieStore = await cookies()
  const accessToken = await getKeycloakAccessTokenFromCookieHeader(cookieStore.toString())

  if (!accessToken) redirect('/')

  const instance = axios.create({
    baseURL: internalApiBaseUrl,
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  instance.interceptors.response.use(res => res, err => {
    if (isUnauthorizedError(err)) redirect('/')

    return Promise.reject(toError(err, 'Server request failed'))
  })

  return instance
}
