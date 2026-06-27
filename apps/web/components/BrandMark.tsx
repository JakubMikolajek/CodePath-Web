import { cn } from '@workspace/ui/lib/utils'

interface BrandMarkProps {
  className?: string
  compact?: boolean
  label?: string
}

export function BrandMark({ className, compact = false, label = 'Nurt Cloud' }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-[11px] text-[15px]', className)}>
      <div aria-hidden="true" className="brand-mark-icon">
        <span className="brand-mark-core" />
      </div>

      {!compact && (
        <span className="font-body font-bold leading-none tracking-normal text-[var(--nurt-title)]">
          {label}
        </span>
      )}
    </div>
  )
}
