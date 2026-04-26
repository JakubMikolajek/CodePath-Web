import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { redirect } from 'next/navigation'

import { isUnauthorizedError, toError } from '@/lib/api/error'

export const createAxiosServer = (cookie: string): AxiosInstance => {
  const instance = axios.create({
    baseURL: process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
    headers: {
      Cookie: cookie
    }
  })

  instance.interceptors.response.use(
    res => res,
    err => {
      if (isUnauthorizedError(err)) {
        redirect('/')
      }
      return Promise.reject(toError(err, 'Server request failed'))
    }
  )

  return instance
}
