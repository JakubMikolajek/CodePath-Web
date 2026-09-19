import type { DashboardSummaryResponse } from '@/lib/dashboard'

import { baseApi } from './baseApi'

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: builder => ({
    getDashboardSummary: builder.query<DashboardSummaryResponse, void>({
      query: () => ({ url: '/dashboard/summary' })
    })
  })
})

export const { useGetDashboardSummaryQuery } = dashboardApi
