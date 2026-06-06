import type { AxiosInstance } from 'axios'

export const HTTP_CLIENT = Symbol('HTTP_CLIENT')

export type HttpClient = AxiosInstance
