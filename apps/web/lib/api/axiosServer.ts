import axios from 'axios'
import { redirect } from 'next/navigation'

export const createAxiosServer = (cookie: string) => {
  const instance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
    headers: {
      Cookie: cookie,
    },
  })

  instance.interceptors.response.use(
    (res) => res,
    (err) => {
      if (err.response?.status === 401) {
        redirect('/')
      }
      return Promise.reject(err)
    },
  )

  return instance
}
