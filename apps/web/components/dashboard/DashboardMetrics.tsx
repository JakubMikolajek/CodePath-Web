import { BotMessageSquare, Braces, FolderGit2 } from 'lucide-react'

import { MetricCard } from '@/components/MetricCard'
import type { DashboardSummaryResponse } from '@/lib/dashboard'

interface DashboardMetricsProps {
  summary: DashboardSummaryResponse
}

export function DashboardMetrics({ summary }: DashboardMetricsProps) {
  return (
    <section aria-label="Workspace metrics" className="grid gap-4 md:grid-cols-3">
      <MetricCard detail="Total repositories" icon={FolderGit2} label="Repositories" value={String(summary.repositories)} />

      <MetricCard detail="Approx. segments with an HTTP method" icon={Braces} label="API Endpoints" value={summary.apiEndpoints === null ? '—' : String(summary.apiEndpoints)} />

      <MetricCard detail="This month" icon={BotMessageSquare} label="AI Sessions" value={String(summary.aiSessionsThisMonth)} />
    </section>
  )
}

export function DashboardMetricsSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading workspace metrics" className="grid gap-4 md:grid-cols-3">
      {['repositories', 'api-endpoints', 'ai-sessions'].map(metric => (
        <div className="nurt-stat-panel h-[116px] animate-pulse p-4 md:px-[18px] md:py-4" key={metric}>
          <div className="h-3 w-24 rounded bg-white/10" />
          <div className="mt-3 h-8 w-16 rounded bg-white/10" />
          <div className="mt-3 h-3 w-32 rounded bg-white/10" />
        </div>
      ))}
    </section>
  )
}
