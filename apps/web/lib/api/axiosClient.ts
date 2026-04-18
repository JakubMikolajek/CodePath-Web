import axios from 'axios'

import { isUnauthorizedError, toError } from '@/lib/api/error'

export const axiosClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  withCredentials: true
})

axiosClient.interceptors.response.use(
  response => response,
  error => {
    if (isUnauthorizedError(error)) {
      if (typeof document !== 'undefined') {
        document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=strict'
      }

      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        window.location.assign('/')
      }
    }
    return Promise.reject(toError(error, 'Client request failed'))
  }
)
