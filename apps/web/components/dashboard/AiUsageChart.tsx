import { Button } from '@workspace/ui/components/button'

import type { DashboardSummaryResponse } from '@/lib/dashboard'
import { buildAiUsageChartPaths, formatCompactNumber } from '@/lib/dashboard-utils'

interface AiUsageChartProps {
  usage: DashboardSummaryResponse['aiUsage']
}

export function AiUsageChart({ usage }: AiUsageChartProps) {
  const { areaPath, linePath } = buildAiUsageChartPaths(usage.daily)

  return (
    <section aria-labelledby="ai-usage-title" className="nurt-panel flex flex-col p-[18px_20px]">
      <div className="mb-1.5 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground" id="ai-usage-title">AI Usage</h2>

          <p className="mt-1.5 text-[11px] text-(--nurt-t3)">Requests</p>

          <p className="text-[26px] font-bold leading-tight text-(--nurt-title)">{formatCompactNumber(usage.total)}</p>
        </div>

        <Button className="rounded-[7px] px-2.25 py-0.75 text-[11px]" size="sm" type="button" variant="glass">This week</Button>
      </div>

      <div className="relative min-h-32.5 flex-1">
        <svg aria-label={`AI requests over the last 7 days, ${usage.total} total`} className="absolute inset-0 size-full" preserveAspectRatio="none" role="img" viewBox="0 0 320 150">
          <defs>
            <linearGradient id="aiFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--nurt-accent2)" stopOpacity="0.5" />

              <stop offset="1" stopColor="var(--nurt-accent2)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path d={areaPath} fill="url(#aiFill)" />

          <path d={linePath} fill="none" stroke="var(--nurt-accent2)" strokeWidth="2.2" />
        </svg>
      </div>

      <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-(--nurt-t4)">
        {usage.daily.map(item => (
          <span key={item.date}>{new Date(`${item.date}T00:00:00.000Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })}</span>
        ))}
      </div>
    </section>
  )
}
