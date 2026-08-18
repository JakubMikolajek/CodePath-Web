import { Card, CardContent } from '@workspace/ui/components/card'
import { Clock3, TriangleAlert } from 'lucide-react'

import type { RepoDocsStatusResponse } from '@/redux/api/docsApi'

import { formatStatus, getStatusTone } from './docsUtils'

export function DocsStatusPanel({ status }: { status?: RepoDocsStatusResponse }) {
  const statusItems = status ? [
    { label: 'Clone', value: status.cloneStatus },
    { label: 'Embeddings', value: status.embeddingStatus },
    { label: 'Docs', value: status.docsStatus }
  ] : []

  const progress = status?.docsProgress

  const progressDetails = progress ? [
    progress.scope ? `scope: ${formatStatus(progress.scope)}` : null,
    progress.moduleKey ? `module: ${progress.moduleKey}` : null,
    progress.sectionKey ? `section: ${formatStatus(progress.sectionKey)}` : null
  ].filter(Boolean).join(' · ') : ''

  const progressCounter = progress && progress.current !== null && progress.total !== null ? `${progress.current}/${progress.total}` : null

  return (
    <>
      <section aria-label="Documentation status" className="grid gap-3.5 md:grid-cols-3">
        {statusItems.length > 0 ? statusItems.map(item => (
          <Card className="rounded-[13px] border-white/6 bg-white/[0.012] py-0" key={item.label}>
            <CardContent className="flex items-center justify-between gap-4 p-[15px_18px]">
              <div>
                <p className="nurt-label text-(--nurt-t3)">{item.label}</p>

                <p className="mt-1.5 text-[17px] font-semibold capitalize text-foreground">{formatStatus(item.value)}</p>
              </div>

              <span className={`rounded-[7px] border px-2.5 py-0.75 font-mono text-[11px] capitalize ${getStatusTone(item.value)}`}>
                {formatStatus(item.value)}
              </span>
            </CardContent>
          </Card>
        )) : (
          <Card className="py-0 md:col-span-3">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <Clock3 className="size-4" />
              Status pipeline is not loaded yet.
            </CardContent>
          </Card>
        )}
      </section>

      {progress && (
        <section aria-label="Documentation generation progress" className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                Docs progress{progress.stage ? ` · ${formatStatus(progress.stage)}` : ''}
              </p>

              <p className="mt-1 text-white">{progress.message ?? 'Documentation generation is running.'}</p>

              {progressDetails && <p className="mt-1 text-xs text-cyan-100/70">{progressDetails}</p>}
            </div>

            {progressCounter && <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">{progressCounter}</span>}
          </div>
        </section>
      )}
      {status?.lastPipelineError && (
        <section aria-label="Pipeline error" className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />

            <p>{status.lastPipelineError}</p>
          </div>
        </section>
      )}
    </>
  )
}
