import type { AxiosInstance, AxiosRequestConfig } from 'axios'

import { axiosClient } from './axiosClient'
import { createAxiosServer } from './axiosServer'

function createClient(client: AxiosInstance) {
  return {
    async delete<T>(url: string, config?: AxiosRequestConfig) {
      return client.delete<T>(url, config).then(res => res.data)
    },
    async get<T>(url: string, config?: AxiosRequestConfig) {
      return client.get<T>(url, config).then(res => res.data)
    },
    async post<T, D>(url: string, data: D, config?: AxiosRequestConfig) {
      return client.post<T>(url, data, config).then(res => res.data)
    },
    async put<T, D>(url: string, data: D, config?: AxiosRequestConfig) {
      return client.put<T>(url, data, config).then(res => res.data)
    }
  }
}

export const apiClient = createClient(axiosClient)

export const apiServer = (cookie: string) => {
  const client = createAxiosServer(cookie)
  return createClient(client)
}
