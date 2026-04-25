import type { ReactNode } from 'react'

interface PageHeaderProps {
  actions?: ReactNode
  description?: string
  eyebrow?: string
  title: string
}

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary/85">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-[-0.055em] text-aurora md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
