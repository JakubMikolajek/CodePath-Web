import { Hexagon } from 'lucide-react'

interface BrandMarkProps {
  compact?: boolean
  label?: string
}

export function BrandMark({ compact = false, label = 'CodePath' }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid size-10 place-items-center rounded-2xl border border-primary/45 bg-primary/15 shadow-[0_0_28px_oklch(0.62_0.24_270/0.38)]">
        <Hexagon className="size-6 fill-primary/25 text-primary" strokeWidth={2.4} />
        <span className="absolute size-2.5 rounded-full bg-cyan-300 shadow-[0_0_14px_oklch(0.78_0.16_220/0.7)]" />
      </div>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-[-0.04em] text-white">
          {label}
        </span>
      )}
    </div>
  )
}
