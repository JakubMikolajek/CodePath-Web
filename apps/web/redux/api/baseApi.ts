import { createApi } from '@reduxjs/toolkit/query/react'
import type { AxiosRequestConfig } from 'axios'

import { axiosClient } from '@/lib/api/axiosClient'
import { isUnauthorizedError, toError } from '@/lib/api/error'

export interface AxiosBaseQueryError {
  data: string;
  status: 'FETCH_ERROR' | number;
}

export const axiosBaseQuery = (): ReturnType<typeof createAxiosBaseQuery> => createAxiosBaseQuery()

function createAxiosBaseQuery() {
  return async ({ url, ...config }: AxiosRequestConfig) => {
    try {
      const response = await axiosClient({ url, ...config })

      return { data: response.data }
    } catch (error) {
      const unauthorized = isUnauthorizedError(error)
      const normalizedError = toError(error, 'Client request failed')
      const responseStatus = typeof error === 'object' && error !== null && 'response' in error
        ? (error as { response?: { status?: number } }).response?.status
        : undefined

      return {
        error: {
          data: normalizedError.message,
          status: unauthorized ? 401 : (responseStatus ?? 'FETCH_ERROR')
        } satisfies AxiosBaseQueryError
      }
    }
  }
}

export const baseApi = createApi({
  baseQuery: axiosBaseQuery(),
  tagTypes: ['RunnerCollection', 'AuthPreset', 'EvaluationRuns', 'EvaluationTrend'],
  endpoints: () => ({})
})
