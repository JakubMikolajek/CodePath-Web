import type { AxiosInstance } from 'axios'
import axios from 'axios'
import { redirect } from 'next/navigation'

let apiInstance: AxiosInstance | null = null

export const createAxiosServer = (cookie: string) => {
  if (apiInstance) return apiInstance

  const instance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
    headers: {
      Cookie: cookie
    }
  })

  instance.interceptors.response.use(
    res => res,
    err => {
      if (err.response?.status === 401) {
        redirect('/')
      }
      return Promise.reject(err)
    }
  )

  apiInstance = instance
  return instance
}

export const getAxiosServerInstance = (): AxiosInstance => {
  if (!apiInstance) {
    throw new Error(
      'Axios server instance not initialized. Call createAxiosServer(cookie) first.'
    )
  }
  return apiInstance
}
