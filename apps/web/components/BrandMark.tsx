import { cn } from '@workspace/ui/lib/utils'

interface BrandMarkProps {
  className?: string
  compact?: boolean
  label?: string
}

export function BrandMark({ className, compact = false, label = 'CodePath' }: BrandMarkProps) {
  return (
    <div className={cn('flex items-center gap-[0.7em] text-lg', className)}>
      <div aria-hidden="true" className="brand-mark-icon">
        <span className="brand-mark-core" />
      </div>
      {!compact && (
        <span className="font-display font-bold leading-none tracking-[-0.045em] text-white">
          {label}
        </span>
      )}
    </div>
  )
}
