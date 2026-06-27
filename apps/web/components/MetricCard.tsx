import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  detail: string
  icon: LucideIcon
  label: string
  value: string
}

export function MetricCard({ detail, icon: Icon, label, value }: MetricCardProps) {
  return (
    <section aria-label={label} className="nurt-stat-panel relative overflow-hidden p-4 md:px-[18px] md:py-4">
      <Icon className="absolute right-3.5 top-3.5 size-4 text-primary opacity-85" />

      <p className="mb-2 text-xs text-muted-foreground">{label}</p>
      <p className="text-[30px] font-bold leading-none text-[var(--nurt-title)]">{value}</p>
      <p className="mt-[7px] text-[11px] text-[var(--nurt-t3)]">{detail}</p>
    </section>
  )
}
