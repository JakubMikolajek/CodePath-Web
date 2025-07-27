import axios from 'axios'
import { redirect } from 'next/navigation'

export const axiosClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api',
  withCredentials: true,
})

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      document.cookie = 'access_token=; Max-Age=0; path=/; SameSite=strict'

      if (typeof window !== 'undefined' && window.location.pathname !== '/') {
        redirect('/')
      }
    }
    return Promise.reject(error)
  },
)
