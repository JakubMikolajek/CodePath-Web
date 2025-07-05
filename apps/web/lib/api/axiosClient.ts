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
      if (typeof window !== 'undefined') {
        redirect('/')
      }
    }
    return Promise.reject(error)
  },
)
