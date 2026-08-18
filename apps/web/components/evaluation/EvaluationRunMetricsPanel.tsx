import type { Nullable } from '@workspace/codepath-common'

import type { EvaluationMetric, EvaluationRun } from '@/lib/evaluations'

import { formatMetricValue } from './evaluationUtils'

interface EvaluationRunMetricsPanelProps {
  error: Nullable<string>
  isError: boolean
  isLoading: boolean
  metrics: EvaluationMetric[]
  selectedRun: Nullable<EvaluationRun>
}

export function EvaluationRunMetricsPanel({
  error,
  isError,
  isLoading,
  metrics,
  selectedRun
}: EvaluationRunMetricsPanelProps) {
  return (
    <section aria-label="Run metrics" className="nurt-panel p-[18px_20px]">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Run metrics</h2>

        <p className="mt-1 text-sm text-muted-foreground">
          {selectedRun ? `Metrics for run #${selectedRun.id}` : 'Select a run to load metrics.'}
        </p>
      </div>

      {!selectedRun && (
        <div className="rounded-[12px] border border-white/6 p-8 text-center text-sm text-muted-foreground">
          No run selected.
        </div>
      )}

      {selectedRun && isLoading && (
        <div className="rounded-[12px] border border-white/6 p-6 text-sm text-muted-foreground" role="status">
          Loading run metrics...
        </div>
      )}

      {selectedRun && isError && (
        <div className="rounded-[12px] border border-red-300/35 bg-red-300/10 p-4 text-sm text-red-100" role="alert">
          {error ?? 'Cannot fetch evaluation metrics'}
        </div>
      )}

      {selectedRun && !isLoading && !isError && metrics.length === 0 && (
        <div className="rounded-[12px] border border-white/6 p-8 text-center text-sm text-muted-foreground">
          This run has no metrics yet.
        </div>
      )}

      {selectedRun && !isLoading && !isError && metrics.length > 0 && (
        <div className="overflow-hidden rounded-[12px] border border-white/6">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/6 bg-white/2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-medium">Metric</th>

                <th className="px-3 py-3 font-medium">Value</th>

                <th className="px-3 py-3 font-medium">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {metrics.map(metric => (
                <tr className="align-top" key={metric.id}>
                  <td className="break-all px-3 py-3 font-mono text-foreground">{metric.metricName}</td>

                  <td className="px-3 py-3 font-mono text-primary">{formatMetricValue(metric.metricValue)}</td>

                  <td className="break-all px-3 py-3 text-muted-foreground">{metric.targetRef ?? 'Repository'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
