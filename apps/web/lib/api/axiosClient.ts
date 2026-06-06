import axios from 'axios'

import { isUnauthorizedError, toError } from '@/lib/api/error'

export const axiosClient = axios.create({
  baseURL: '/api/backend',
  withCredentials: true
})

axiosClient.interceptors.response.use(
  response => response,
  error => {
    if (isUnauthorizedError(error)) {
      if (typeof window !== 'undefined' && window.location.pathname !== '/') window.location.assign('/')
    }
    return Promise.reject(toError(error, 'Client request failed'))
  }
)
