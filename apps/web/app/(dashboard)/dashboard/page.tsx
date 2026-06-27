import { Button } from '@workspace/ui/components/button'
import { BotMessageSquare, Braces, CalendarDays, FolderGit2, GitPullRequestArrow, Sparkles, UsersRound } from 'lucide-react'

import { MetricCard } from '@/components/MetricCard'
import { PageHeader } from '@/components/PageHeader'
import { SystemStatusPanel } from '@/components/SystemStatusPanel'

const recentActivity = [
  { icon: GitPullRequestArrow, meta: 'in Nurt Cloud', time: '2m ago', title: 'Updated authentication flow', tone: 'from-pink-500 to-amber-400' },
  { icon: Braces, meta: '/api/v1/users/me', time: '10m ago', title: 'Added new API endpoint', tone: 'from-blue-500 to-cyan-300' },
  { icon: FolderGit2, meta: 'in Nurt Cloud AI', time: '1h ago', title: 'Updated documentation', tone: 'from-amber-500 to-yellow-300' },
  { icon: Sparkles, meta: 'in Nurt Studio', time: '3h ago', title: 'Fixed issue with session', tone: 'from-emerald-500 to-lime-300' }
]

const sessions = [
  ['Session for repo 2', 'Yesterday'],
  ['How to add rate limiting?', '2d ago'],
  ['Explain config structure', '3d ago'],
  ['Optimize auth flow', '5d ago']
]

export default function Page() {
  return (
    <div className="space-y-[18px]">
      <PageHeader
        actions={(
          <Button className="rounded-[9px] px-[13px] py-2 text-[12.5px]" variant="glass">
            <CalendarDays className="size-[13px]" />
            This week
          </Button>
        )}
        description="Detailed analytics and insights across repositories, APIs, AI sessions and generated documentation."
        title="Dashboard"
      />

      <section aria-label="Workspace metrics" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Total repositories" icon={FolderGit2} label="Repositories" value="24" />

        <MetricCard detail="Total endpoints" icon={Braces} label="API Endpoints" value="310" />

        <MetricCard detail="This month" icon={BotMessageSquare} label="AI Sessions" value="128" />

        <MetricCard detail="Online now" icon={UsersRound} label="Active Users" value="12" />
      </section>

      <SystemStatusPanel />

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="nurt-panel p-[18px_20px]">
          <div className="mb-[14px] flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-foreground">Recent activity</h2>

            <Button className="h-auto px-0 py-0 text-[11.5px] text-primary hover:bg-transparent hover:text-primary" size="sm" variant="ghost">View all</Button>
          </div>

          <div className="space-y-[14px]">
            {recentActivity.map(item => {
              const Icon = item.icon

              return (
                <div className="flex items-center gap-3" key={item.title}>
                  <div className={`grid size-8 shrink-0 place-items-center rounded-[9px] bg-linear-to-br ${item.tone} text-[var(--nurt-ink)]`}>
                    <Icon className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-foreground">{item.title}</p>

                    <p className="mt-0.5 truncate font-mono text-[10.5px] text-[var(--nurt-t3)]">{item.meta}</p>
                  </div>

                  <span className="shrink-0 text-[11px] text-[var(--nurt-t3)]">{item.time}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="nurt-panel flex flex-col p-[18px_20px]">
          <div className="mb-1.5 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">AI Usage</h2>

              <p className="mt-1.5 text-[11px] text-[var(--nurt-t3)]">Requests</p>

              <p className="text-[26px] font-bold leading-tight text-[var(--nurt-title)]">12k</p>
            </div>

            <Button className="rounded-[7px] px-[9px] py-[3px] text-[11px]" size="sm" variant="glass">This week</Button>
          </div>

          <div className="relative min-h-[130px] flex-1">
            <svg aria-label="AI usage trend chart" className="absolute inset-0 size-full" preserveAspectRatio="none" role="img" viewBox="0 0 320 150">
              <defs>
                <linearGradient id="aiFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--nurt-accent2)" stopOpacity="0.5" />

                  <stop offset="1" stopColor="var(--nurt-accent2)" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path d="M0 120 C 30 116 50 112 70 110 S 110 96 130 92 S 165 70 190 78 S 215 60 240 40 S 270 36 300 18 L 320 12 L 320 150 L 0 150 Z" fill="url(#aiFill)" />

              <path d="M0 120 C 30 116 50 112 70 110 S 110 96 130 92 S 165 70 190 78 S 215 60 240 40 S 270 36 300 18 L 320 12" fill="none" stroke="var(--nurt-accent2)" strokeWidth="2.2" />
            </svg>
          </div>

          <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-[var(--nurt-t4)]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}
          </div>
        </div>

        <aside aria-label="Recent chat sessions" className="nurt-panel p-[18px_20px]">
          <h2 className="mb-[14px] text-[15px] font-semibold text-foreground">Recent chats</h2>

          <div>
            {sessions.map(([title, time], index) => (
              <div className={index === 0 ? 'py-2.5' : 'border-t border-white/[0.06] py-2.5'} key={title}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[12.5px] text-foreground">{title}</p>

                  <span className="shrink-0 text-[11px] text-[var(--nurt-t3)]">{time}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  )
}
