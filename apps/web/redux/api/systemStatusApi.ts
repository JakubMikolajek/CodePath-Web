import type { SystemStatusResponse } from '@/lib/system-status'

import { baseApi } from './baseApi'

export const systemStatusApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getSystemStatus: builder.query<SystemStatusResponse, void>({
      query: () => ({ url: '/system/status' })
    })
  })
})

export const { useGetSystemStatusQuery } = systemStatusApi
