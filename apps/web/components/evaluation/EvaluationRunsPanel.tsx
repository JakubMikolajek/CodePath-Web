import type { Nullable } from '@workspace/codepath-common'
import { Activity } from 'lucide-react'

import type { EvaluationRun } from '@/lib/evaluations'

import { formatDateTime, getStatusDot, getStatusTone } from './evaluationUtils'

interface EvaluationRunsPanelProps {
  error: Nullable<string>
  isError: boolean
  isLoading: boolean
  onSelect: (runId: number) => void
  runs: EvaluationRun[]
  selectedRunId: Nullable<number>
}

export function EvaluationRunsPanel({
  error,
  isError,
  isLoading,
  onSelect,
  runs,
  selectedRunId
}: EvaluationRunsPanelProps) {
  return (
    <section aria-label="Evaluation runs" className="nurt-panel p-[18px_20px]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Runs</h2>

          <p className="mt-1 text-sm text-muted-foreground">Newest evaluation runs first.</p>
        </div>

        <span className="font-mono text-xs text-(--nurt-t3)">{runs.length} shown</span>
      </div>

      {isLoading && (
        <div className="rounded-[12px] border border-white/6 p-6 text-sm text-muted-foreground" role="status">
          Loading evaluation runs...
        </div>
      )}

      {isError && (
        <div className="rounded-[12px] border border-red-300/35 bg-red-300/10 p-4 text-sm text-red-100" role="alert">
          {error ?? 'Cannot fetch evaluation runs'}
        </div>
      )}

      {!isLoading && !isError && runs.length === 0 && (
        <div className="rounded-[12px] border border-white/6 p-8 text-center text-sm text-muted-foreground">
          No evaluation runs have been created for this repository yet.
        </div>
      )}

      {!isLoading && !isError && runs.length > 0 && (
        <div className="space-y-2">
          {runs.map(run => {
            const isSelected = run.id === selectedRunId

            return (
              <button
                aria-pressed={isSelected}
                className={`w-full rounded-[12px] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${isSelected ? 'border-primary/45 bg-primary/10' : 'border-white/6 bg-white/[0.012] hover:border-primary/25 hover:bg-white/3'}`}
                key={run.id}
                onClick={() => onSelect(run.id)}
                type="button"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-foreground">Run #{run.id}</span>

                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {run.runType}
                      </span>

                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] capitalize ${getStatusTone(run.status)}`}>
                        <span className={`size-1.5 rounded-full ${getStatusDot(run.status)}`} />

                        {run.status}
                      </span>
                    </div>

                    <dl className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                      <div>
                        <dt className="font-mono text-(--nurt-t3)">Triggered</dt>

                        <dd className="mt-1">{formatDateTime(run.triggeredAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-(--nurt-t3)">Completed</dt>

                        <dd className="mt-1">{formatDateTime(run.completedAt)}</dd>
                      </div>
                    </dl>
                  </div>

                  <Activity className="size-4 shrink-0 text-(--nurt-t3)" />
                </div>

                {run.status === 'failed' && run.errorMessage && (
                  <p className="mt-3 rounded-[9px] border border-red-300/25 bg-red-300/10 p-3 text-xs leading-5 text-red-100">
                    {run.errorMessage}
                  </p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
