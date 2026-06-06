import type { AxiosInstance } from 'axios'

export const HTTP_CLIENT = Symbol('HTTP_CLIENT')

// TODO use instead of AxiosInstance
export type HttpClient = AxiosInstance
