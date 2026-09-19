'use client'

import { Button } from '@workspace/ui/components/button'
import type { ReactNode } from 'react'

import { AiUsageChart } from '@/components/dashboard/AiUsageChart'
import { DashboardMetrics, DashboardMetricsSkeleton } from '@/components/dashboard/DashboardMetrics'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { RecentChats } from '@/components/dashboard/RecentChats'
import { useGetDashboardSummaryQuery } from '@/redux/api/dashboardApi'

interface DashboardContentProps {
  children: ReactNode
}

function DashboardPanelsSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading dashboard details" className="grid gap-4 xl:grid-cols-3">
      {['activity', 'usage', 'chats'].map(panel => <div className="nurt-panel h-[248px] animate-pulse bg-white/3" key={panel} />)}
    </section>
  )
}

export function DashboardContent({ children }: DashboardContentProps) {
  const { data, error, isLoading, refetch } = useGetDashboardSummaryQuery()

  if (isLoading) {
    return (
      <>
        <DashboardMetricsSkeleton />
        {children}
        <DashboardPanelsSkeleton />
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <section aria-label="Dashboard data" className="nurt-panel flex flex-wrap items-center justify-between gap-3 p-[18px_20px]" role="alert">
          <p className="text-sm text-red-100">Cannot load dashboard data.</p>

          <Button className="rounded-[8px] text-xs" onClick={() => void refetch()} size="sm" type="button" variant="glass">Retry</Button>
        </section>
        {children}
      </>
    )
  }

  return (
    <>
      <DashboardMetrics summary={data} />
      {children}
      <section className="grid gap-4 xl:grid-cols-3">
        <RecentActivity activity={data.recentActivity} />
        <AiUsageChart usage={data.aiUsage} />
        <RecentChats chats={data.recentChats} />
      </section>
    </>
  )
}
