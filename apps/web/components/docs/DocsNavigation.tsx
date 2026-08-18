import type { Nullable, Undefinable } from '@workspace/codepath-common'
import type { RepoDocsModule, RepoDocsSection } from '@workspace/codepath-common/repository'
import { RepoDocsStatus } from '@workspace/codepath-common/repository'
import { BookOpen, CheckCircle2, Clock3, FileText } from 'lucide-react'

import { formatDateTime, formatStatus } from './docsUtils'

interface DocsNavigationProps {
  activeModule: Nullable<RepoDocsModule>
  activeSection: Nullable<RepoDocsSection>
  modules: RepoDocsModule[]
  onModuleSelect: (module: RepoDocsModule) => void
  onSectionSelect: (section: RepoDocsSection) => void
  status: Undefinable<RepoDocsStatus>
}

const describeDocsNode = (input: {
  error?: Nullable<string>
  generatedAt: Nullable<string>
  status: RepoDocsStatus
  title: string
}) => [
  input.title,
  `status: ${formatStatus(input.status)}`,
  formatDateTime(input.generatedAt) ? `generated: ${formatDateTime(input.generatedAt)}` : null,
  input.error ? `error: ${input.error}` : null
].filter(Boolean).join(' · ')

const statusDot = (status: RepoDocsStatus) => (
  status === RepoDocsStatus.READY ? 'bg-emerald-300'
    : status === RepoDocsStatus.FAILED ? 'bg-red-300'
      : status === RepoDocsStatus.PROCESSING ? 'bg-cyan-300'
        : 'bg-slate-500'
)

export function DocsNavigation({
  activeModule,
  activeSection,
  modules,
  onModuleSelect,
  onSectionSelect,
  status
}: DocsNavigationProps) {
  return (
    <aside
      aria-label="Documentation navigation"
      className="flex w-70 shrink-0 flex-col overflow-hidden rounded-[14px] border border-white/6 bg-white/[0.012]"
    >
      <div className="flex items-center gap-2 border-b border-white/6 px-4 py-3.5 text-[13px] font-semibold text-foreground">
        <BookOpen className="size-3.75 text-primary" />
        Documentation
      </div>

      <nav
        aria-label="Documentation modules"
        className="flex-1 space-y-4 overflow-y-auto p-3 text-sm"
      >
        <div className="space-y-2">
          <p className="nurt-label px-2 pb-1 text-(--nurt-t3)">MODULES</p>

          {modules.map(module => {
            const isActive = module.key === activeModule?.key

            return (
              <button
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[12.5px] transition ${isActive ? 'border border-primary/30 bg-primary/12 text-foreground' : 'text-muted-foreground hover:bg-white/3 hover:text-foreground'}`}
                key={module.key}
                onClick={() => onModuleSelect(module)}
                title={describeDocsNode(module)}
                type="button"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <BookOpen className="size-4 shrink-0" />

                  <span className="truncate">{module.title}</span>
                </span>

                <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(module.status)}`} />
              </button>
            )
          })}
        </div>

        {activeModule && (
          <div className="space-y-2 border-t border-white/10 pt-4">
            <p className="nurt-label px-2 pb-1 text-(--nurt-t3)">SECTIONS</p>

            {activeModule.sections.map(section => {
              const isActive = section.key === activeSection?.key

              return (
                <button
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-xs transition ${isActive ? 'bg-primary/15 text-foreground before:absolute before:left-0 before:top-1.75 before:bottom-1.75 before:w-0.5 before:rounded before:bg-primary' : 'text-muted-foreground hover:bg-white/3 hover:text-foreground'}`}
                  key={`${activeModule.key}:${section.key}`}
                  onClick={() => onSectionSelect(section)}
                  title={describeDocsNode(section)}
                  type="button"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <FileText className="size-4 shrink-0" />

                    <span className="truncate">{section.title}</span>
                  </span>

                  <span className={`h-2 w-2 shrink-0 rounded-full ${statusDot(section.status)}`} />
                </button>
              )
            })}
          </div>
        )}
      </nav>
      <div className="border-t border-white/6 p-[11px_14px] text-[11px] leading-[1.4] text-(--nurt-t3)">
        {status === RepoDocsStatus.READY ? (
          <span className="flex items-center gap-2 text-emerald-200">
            <CheckCircle2 className="size-4" />
            Documentation is ready.
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <Clock3 className="size-4" />
            Generation depends on cloned repo and embeddings.
          </span>
        )
        }
      </div>
    </aside>
  )
}
