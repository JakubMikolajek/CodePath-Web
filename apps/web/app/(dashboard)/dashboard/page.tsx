import { Button } from '@workspace/ui/components/button'
import { BotMessageSquare, Braces, CalendarDays, FolderGit2, GitPullRequestArrow, Sparkles, UsersRound } from 'lucide-react'

import { MetricCard } from '@/components/MetricCard'
import { PageHeader } from '@/components/PageHeader'

const recentActivity = [
  { icon: GitPullRequestArrow, meta: 'in CodePath-Web', time: '2m ago', title: 'Updated authentication flow', tone: 'from-pink-500 to-amber-400' },
  { icon: Braces, meta: '/api/v1/users/me', time: '10m ago', title: 'Added new API endpoint', tone: 'from-blue-500 to-cyan-300' },
  { icon: FolderGit2, meta: 'in CodePath-AI', time: '1h ago', title: 'Updated documentation', tone: 'from-amber-500 to-yellow-300' },
  { icon: Sparkles, meta: 'in CodePath-Desktop', time: '3h ago', title: 'Fixed issue with session', tone: 'from-emerald-500 to-lime-300' }
]

const sessions = [
  ['Session for repo 2', 'Yesterday'],
  ['How to add rate limiting?', '2d ago'],
  ['Explain config structure', '3d ago'],
  ['Optimize auth flow', '5d ago']
]

export default function Page() {
  return (
    <div className="space-y-8">
      <PageHeader
        actions={(
          <Button className="h-12 rounded-2xl" variant="glass">
            <CalendarDays className="size-4" />
            This week
          </Button>
        )}
        description="Detailed analytics and insights across repositories, APIs, AI sessions and generated documentation."
        title="Dashboard"
      />

      <section aria-label="Workspace metrics" className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard detail="Total repositories" icon={FolderGit2} label="Repositories" value="24" />

        <MetricCard detail="Total endpoints" icon={Braces} label="API Endpoints" value="310" />

        <MetricCard detail="This month" icon={BotMessageSquare} label="AI Sessions" value="128" />

        <MetricCard detail="Online now" icon={UsersRound} label="Active Users" value="12" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr_0.72fr]">
        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-7 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Recent activity</h2>

            <Button size="sm" variant="ghost">View all</Button>
          </div>

          <div className="space-y-5">
            {recentActivity.map(item => {
              const Icon = item.icon

              return (
                <div className="flex items-center gap-4" key={item.title}>
                  <div className={`grid size-10 place-items-center rounded-full bg-linear-to-br ${item.tone} text-white shadow-[0_0_22px_rgb(80_120_255/0.18)]`}>
                    <Icon className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white">{item.title}</p>

                    <p className="truncate text-sm text-muted-foreground">{item.meta}</p>
                  </div>

                  <span className="text-sm text-muted-foreground">{item.time}</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">AI Usage</h2>

              <p className="mt-5 text-sm text-muted-foreground">Requests</p>

              <p className="text-3xl font-bold tracking-[-0.055em] text-white">12k</p>
            </div>

            <Button size="sm" variant="glass">This week</Button>
          </div>

          <div className="relative h-64 overflow-hidden rounded-2xl border border-border/40 bg-[#050f24]/60 p-5">
            <div className="absolute inset-x-5 bottom-12 top-8 bg-[linear-gradient(to_bottom,transparent_0,transparent_23%,oklch(1_0_0/0.06)_24%,transparent_25%,transparent_48%,oklch(1_0_0/0.06)_49%,transparent_50%,transparent_74%,oklch(1_0_0/0.06)_75%,transparent_76%)]" />

            <svg aria-label="AI usage trend chart" className="relative z-10 h-full w-full" role="img" viewBox="0 0 420 210">
              <defs>
                <linearGradient id="usageFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.66 0.27 292 / 0.75)" />

                  <stop offset="100%" stopColor="oklch(0.5 0.24 258 / 0.05)" />
                </linearGradient>
              </defs>

              <path d="M14 164 C36 140 52 170 74 138 C98 102 112 132 138 102 C168 70 184 105 210 78 C244 40 248 158 286 112 C318 74 342 132 368 86 C394 42 404 58 410 28 L410 210 L14 210 Z" fill="url(#usageFill)" />

              <path d="M14 164 C36 140 52 170 74 138 C98 102 112 132 138 102 C168 70 184 105 210 78 C244 40 248 158 286 112 C318 74 342 132 368 86 C394 42 404 58 410 28" fill="none" stroke="oklch(0.68 0.27 292)" strokeLinecap="round" strokeWidth="4" />
            </svg>

            <div className="absolute inset-x-8 bottom-4 flex justify-between text-xs text-muted-foreground">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}
            </div>
          </div>
        </div>

        <aside aria-label="Recent chat sessions" className="glass-panel rounded-3xl p-6">
          <h2 className="mb-6 text-xl font-bold text-white">Recent chats</h2>

          <div className="space-y-2">
            {sessions.map(([title, time]) => (
              <div className="rounded-2xl border border-border/35 bg-background/25 px-4 py-4" key={title}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium text-white">{title}</p>

                  <span className="shrink-0 text-sm text-muted-foreground">{time}</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  )
}
