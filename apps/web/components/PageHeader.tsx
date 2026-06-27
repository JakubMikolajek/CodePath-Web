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
        {eyebrow && <p className="nurt-label mb-2 text-primary">{eyebrow}</p>}

        <h1 className="bg-[linear-gradient(120deg,#dbe6ff,#9fb6e6)] bg-clip-text font-mono text-[28px] font-bold leading-tight text-transparent md:text-[30px]">{title}</h1>

        {description && <p className="mt-2 max-w-2xl text-[12.5px] leading-5 text-muted-foreground md:text-[13px]">{description}</p>}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
