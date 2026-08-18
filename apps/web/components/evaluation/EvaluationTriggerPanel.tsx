import type { Nullable } from '@workspace/codepath-common'
import { TriangleAlert } from 'lucide-react'

import { EVALUATION_RUN_TYPES, type EvaluationRunType } from '@/lib/evaluations'

import { RUN_TYPE_LABELS } from './evaluationUtils'

interface EvaluationTriggerPanelProps {
  error: Nullable<string>
  isLoading: boolean
  message: Nullable<string>
  onRunTypeChange: (runType: EvaluationRunType) => void
  runType: EvaluationRunType
}

export function EvaluationTriggerPanel({
  error,
  isLoading,
  message,
  onRunTypeChange,
  runType
}: EvaluationTriggerPanelProps) {
  return (
    <section aria-label="Evaluation trigger" className="nurt-panel p-[18px_20px]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <label className="flex flex-1 flex-col gap-2 text-sm text-foreground">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Run type</span>

          <select
            className="h-10 rounded-[9px] border border-white/10 bg-(--nurt-bg0) px-3 font-mono text-sm text-foreground outline-none transition hover:border-primary/35 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
            onChange={event => onRunTypeChange(event.target.value as EvaluationRunType)}
            value={runType}
          >
            {EVALUATION_RUN_TYPES.map(option => (
              <option key={option} value={option}>{RUN_TYPE_LABELS[option]}</option>
            ))}
          </select>
        </label>

        <p className="max-w-2xl text-xs leading-5 text-muted-foreground">
          Triggering queues a worker job. The run appears after the worker picks it up; use refresh to update this view.
        </p>
      </div>

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100" role="status">
          {message}. Refresh when the worker has had time to create the run.
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-300/35 bg-red-300/10 p-3 text-sm text-red-100" role="alert">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />

          <span>{error}</span>
        </div>
      )}
    </section>
  )
}
