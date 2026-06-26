import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  detail: string
  icon: LucideIcon
  label: string
  value: string
}

export function MetricCard({ detail, icon: Icon, label, value }: MetricCardProps) {
  return (
    <section aria-label={label} className="glass-panel rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-[-0.06em] text-white">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        <div className="grid size-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
    </section>
  )
}
