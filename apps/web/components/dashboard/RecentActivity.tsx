import { Braces, FolderGit2, GitPullRequestArrow, Sparkles } from 'lucide-react'

import type { DashboardRecentActivity } from '@/lib/dashboard'
import { formatRelativeTime } from '@/lib/dashboard-utils'

const activityPresentation = {
  chat_started: { icon: Sparkles, tone: 'from-emerald-500 to-lime-300' },
  docs_ready: { icon: FolderGit2, tone: 'from-amber-500 to-yellow-300' },
  repo_cloned: { icon: GitPullRequestArrow, tone: 'from-pink-500 to-amber-400' },
  repo_embedded: { icon: Braces, tone: 'from-blue-500 to-cyan-300' }
} as const

interface RecentActivityProps {
  activity: DashboardRecentActivity[]
}

export function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <section aria-labelledby="recent-activity-title" className="nurt-panel p-[18px_20px]">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-foreground" id="recent-activity-title">Recent activity</h2>
      </div>

      {activity.length === 0 ? (
        <p className="py-5 text-center text-[12.5px] text-(--nurt-t3)">No recent activity yet</p>
      ) : (
        <div className="space-y-3.5">
          {activity.map(item => {
            const { icon: Icon, tone } = activityPresentation[item.kind]

            return (
              <div className="flex items-center gap-3" key={`${item.occurredAt}-${item.title}`}>
                <div className={`grid size-8 shrink-0 place-items-center rounded-[9px] bg-linear-to-br ${tone} text-(--nurt-ink)`}>
                  <Icon className="size-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-foreground">{item.title}</p>

                  <p className="mt-0.5 truncate font-mono text-[10.5px] text-(--nurt-t3)">{item.meta}</p>
                </div>

                <span className="shrink-0 text-[11px] text-(--nurt-t3)">{formatRelativeTime(item.occurredAt)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
