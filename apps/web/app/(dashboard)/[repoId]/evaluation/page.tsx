'use client'

import { Button } from '@workspace/ui/components/button'
import { Activity, FlaskConical, RefreshCcw, TriangleAlert } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import { PageHeader } from '@/components/PageHeader'
import { EVALUATION_RUN_TYPES, type EvaluationRunStatus, type EvaluationRunType } from '@/lib/evaluations'
import { getFirstRouteParam } from '@/lib/route-params'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import {
  getEvaluationRunMetrics,
  getEvaluationRuns,
  getEvaluationTrend,
  triggerEvaluation
} from '@/redux/slices/evaluationSlice'

const RUN_TYPE_LABELS: Record<EvaluationRunType, string> = {
  chat_faithfulness: 'Chat faithfulness',
  docs_quality: 'Docs quality',
  full: 'Full',
  retrieval: 'Retrieval'
}

const LINE_COLORS = ['#7dd3fc', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#f472b6', '#60a5fa']

interface TrendChartRow {
  label: string
  timestamp: number
  [metricKey: string]: number | string
}

const formatDateTime = (value: string | null) => {
  if (!value) return 'Not completed'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(parsed)
}

const formatShortDateTime = (value: number) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date(value))

const formatMetricValue = (value: number) => {
  if (!Number.isFinite(value)) return 'n/a'
  if (Math.abs(value) >= 100) return value.toFixed(1)

  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}

const getStatusTone = (status: EvaluationRunStatus) => {
  if (status === 'completed') return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200'
  if (status === 'failed') return 'border-red-300/35 bg-red-300/10 text-red-200'
  if (status === 'running') return 'border-cyan-300/35 bg-cyan-300/10 text-cyan-200'

  return 'border-amber-300/35 bg-amber-300/10 text-amber-200'
}

const getStatusDot = (status: EvaluationRunStatus) => {
  if (status === 'completed') return 'bg-emerald-300'
  if (status === 'failed') return 'bg-red-300'
  if (status === 'running') return 'bg-cyan-300'

  return 'bg-amber-300'
}

export default function Page() {
  const params = useParams()
  const dispatch = useAppDispatch()
  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const metrics = useAppSelector(state => state.evaluation.metrics)
  const metricsError = useAppSelector(state => state.evaluation.metricsError)
  const metricsStatus = useAppSelector(state => state.evaluation.metricsStatus)
  const runs = useAppSelector(state => state.evaluation.runs)
  const runsError = useAppSelector(state => state.evaluation.error)
  const runsStatus = useAppSelector(state => state.evaluation.runsStatus)
  const selectedRunId = useAppSelector(state => state.evaluation.selectedRunId)
  const trend = useAppSelector(state => state.evaluation.trend)
  const trendError = useAppSelector(state => state.evaluation.trendError)
  const trendStatus = useAppSelector(state => state.evaluation.trendStatus)
  const triggerError = useAppSelector(state => state.evaluation.triggerError)
  const triggerMessage = useAppSelector(state => state.evaluation.triggerMessage)
  const triggerStatus = useAppSelector(state => state.evaluation.triggerStatus)

  const [runType, setRunType] = useState<EvaluationRunType>('docs_quality')

  useEffect(() => {
    if (!Number.isFinite(repoId)) return

    void dispatch(getEvaluationRuns({ repoId }))
    void dispatch(getEvaluationTrend(repoId))
  }, [dispatch, repoId])

  const selectedRun = useMemo(() => runs.find(run => run.id === selectedRunId) ?? null, [runs, selectedRunId])

  const metricKeys = useMemo(() => new Map(trend.map((point, index) => [point.metricName, `metric_${index}`])), [trend])

  const trendChartRows = useMemo(() => {
    const rowsByTimestamp = new Map<number, TrendChartRow>()

    for (const point of trend) {
      const metricKey = metricKeys.get(point.metricName)
      if (!metricKey || !Number.isFinite(point.averageMetricValue)) continue

      const timestamps = [point.firstMetricAt, point.lastMetricAt]
        .map(value => value ? Date.parse(value) : Number.NaN)
        .filter(value => Number.isFinite(value))
      const uniqueTimestamps = [...new Set(timestamps)]

      for (const timestamp of uniqueTimestamps) {
        const row = rowsByTimestamp.get(timestamp) ?? {
          label: formatShortDateTime(timestamp),
          timestamp
        }

        row[metricKey] = point.averageMetricValue
        rowsByTimestamp.set(timestamp, row)
      }
    }

    return [...rowsByTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp)
  }, [metricKeys, trend])

  const trendTimeDomain = useMemo<[number, number]>(() => {
    if (trendChartRows.length === 0) return [0, 1]

    const timestamps = trendChartRows.map(row => row.timestamp)
    const min = Math.min(...timestamps)
    const max = Math.max(...timestamps)

    if (min === max) return [min - 60_000, max + 60_000]

    return [min, max]
  }, [trendChartRows])

  const refreshEvaluationData = () => {
    if (!Number.isFinite(repoId)) return

    void dispatch(getEvaluationRuns({ repoId }))
    void dispatch(getEvaluationTrend(repoId))

    if (selectedRunId) void dispatch(getEvaluationRunMetrics({ repoId, runId: selectedRunId }))
  }

  const handleTrigger = () => {
    if (!Number.isFinite(repoId)) return

    void dispatch(triggerEvaluation({ repoId, runType }))
  }

  const handleRunSelect = (runId: number) => {
    if (!Number.isFinite(repoId)) return

    void dispatch(getEvaluationRunMetrics({ repoId, runId }))
  }

  return (
    <div className="space-y-[14px]">
      <PageHeader
        actions={(
          <>
            <Button className="rounded-[9px] px-[13px] py-2 text-[12.5px]" onClick={refreshEvaluationData} type="button" variant="glass">
              <RefreshCcw className="size-4" />
              Refresh
            </Button>

            <Button className="rounded-[9px] px-[14px] py-2 text-[12.5px]" disabled={triggerStatus === 'loading'} onClick={handleTrigger} type="button" variant="glow">
              <FlaskConical className="size-4" />
              {triggerStatus === 'loading' ? 'Queueing...' : 'Run evaluation'}
            </Button>
          </>
        )}
        description="Review evaluation runs, metrics and aggregate metric trends"
        eyebrow={`Repo ${Number.isFinite(repoId) ? repoId : 'unknown'}`}
        title="Evaluation Worker"
      />

      <section aria-label="Evaluation trigger" className="nurt-panel p-[18px_20px]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <label className="flex flex-1 flex-col gap-2 text-sm text-foreground">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Run type</span>
            <select
              className="h-10 rounded-[9px] border border-white/10 bg-[var(--nurt-bg0)] px-3 font-mono text-sm text-foreground outline-none transition hover:border-primary/35 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={triggerStatus === 'loading'}
              onChange={event => setRunType(event.target.value as EvaluationRunType)}
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

        {triggerStatus === 'success' && triggerMessage && (
          <div className="mt-4 rounded-[10px] border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm text-emerald-100" role="status">
            {triggerMessage}. Refresh when the worker has had time to create the run.
          </div>
        )}

        {triggerStatus === 'error' && triggerError && (
          <div className="mt-4 flex items-start gap-2 rounded-[10px] border border-red-300/35 bg-red-300/10 p-3 text-sm text-red-100" role="alert">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <span>{triggerError}</span>
          </div>
        )}
      </section>

      <section aria-label="Metric trend" className="nurt-panel p-[18px_20px]">
        <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Metric trend</h2>
            <p className="mt-1 text-sm text-muted-foreground">Aggregate metric values over the sampled metric time range.</p>
          </div>

          <span className="font-mono text-xs text-[var(--nurt-t3)]">{trend.length} metric{trend.length === 1 ? '' : 's'}</span>
        </div>

        {trendStatus === 'loading' && (
          <div className="rounded-[12px] border border-white/[0.06] p-6 text-sm text-muted-foreground" role="status">
            Loading metric trend...
          </div>
        )}

        {trendStatus === 'error' && (
          <div className="rounded-[12px] border border-red-300/35 bg-red-300/10 p-4 text-sm text-red-100" role="alert">
            {trendError ?? 'Cannot fetch evaluation trend'}
          </div>
        )}

        {trendStatus === 'empty' && (
          <div className="rounded-[12px] border border-white/[0.06] p-8 text-center text-sm text-muted-foreground">
            No metric trend data is available yet.
          </div>
        )}

        {trendStatus === 'success' && trendChartRows.length === 0 && (
          <div className="rounded-[12px] border border-amber-300/35 bg-amber-300/10 p-4 text-sm text-amber-100">
            Trend metrics exist, but none include valid timestamps for charting.
          </div>
        )}

        {trendStatus === 'success' && trendChartRows.length > 0 && (
          <>
            <div className="h-[320px] rounded-[12px] border border-white/[0.06] bg-[var(--nurt-bg0)] p-3">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={trendChartRows} margin={{ bottom: 8, left: 0, right: 18, top: 10 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    domain={trendTimeDomain}
                    stroke="rgba(220,230,255,0.5)"
                    tick={{ fill: 'rgba(220,230,255,0.66)', fontSize: 11 }}
                    tickFormatter={(value: number | string) => formatShortDateTime(Number(value))}
                    type="number"
                  />
                  <YAxis
                    stroke="rgba(220,230,255,0.5)"
                    tick={{ fill: 'rgba(220,230,255,0.66)', fontSize: 11 }}
                    tickFormatter={(value: number | string) => formatMetricValue(Number(value))}
                    width={54}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--nurt-bg2)',
                      border: '1px solid var(--nurt-line)',
                      borderRadius: 10,
                      color: 'var(--foreground)'
                    }}
                    labelFormatter={label => formatDateTime(new Date(Number(label)).toISOString())}
                    formatter={(value, name) => [formatMetricValue(Number(value)), String(name)]}
                  />
                  {trend.map((point, index) => (
                    <Line
                      connectNulls
                      dataKey={metricKeys.get(point.metricName) ?? point.metricName}
                      dot={{ r: 3 }}
                      isAnimationActive={false}
                      key={point.metricName}
                      name={point.metricName}
                      stroke={LINE_COLORS[index % LINE_COLORS.length]}
                      strokeWidth={2}
                      type="monotone"
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {trend.map(point => (
                <div className="rounded-[10px] border border-white/[0.06] bg-white/[0.015] p-3" key={point.metricName}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="break-all font-mono text-sm text-foreground">{point.metricName}</p>
                    <p className="font-mono text-sm text-primary">{formatMetricValue(point.averageMetricValue)}</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {point.sampleCount} sample{point.sampleCount === 1 ? '' : 's'} from {formatDateTime(point.firstMetricAt)} to {formatDateTime(point.lastMetricAt)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="grid gap-[14px] xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section aria-label="Evaluation runs" className="nurt-panel p-[18px_20px]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Runs</h2>
              <p className="mt-1 text-sm text-muted-foreground">Newest evaluation runs first.</p>
            </div>

            <span className="font-mono text-xs text-[var(--nurt-t3)]">{runs.length} shown</span>
          </div>

          {runsStatus === 'loading' && (
            <div className="rounded-[12px] border border-white/[0.06] p-6 text-sm text-muted-foreground" role="status">
              Loading evaluation runs...
            </div>
          )}

          {runsStatus === 'error' && (
            <div className="rounded-[12px] border border-red-300/35 bg-red-300/10 p-4 text-sm text-red-100" role="alert">
              {runsError ?? 'Cannot fetch evaluation runs'}
            </div>
          )}

          {runsStatus === 'empty' && (
            <div className="rounded-[12px] border border-white/[0.06] p-8 text-center text-sm text-muted-foreground">
              No evaluation runs have been created for this repository yet.
            </div>
          )}

          {runsStatus === 'success' && (
            <div className="space-y-2">
              {runs.map(run => {
                const isSelected = run.id === selectedRunId

                return (
                  <button
                    aria-pressed={isSelected}
                    className={`w-full rounded-[12px] border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${isSelected ? 'border-primary/45 bg-primary/10' : 'border-white/[0.06] bg-white/[0.012] hover:border-primary/25 hover:bg-white/[0.03]'}`}
                    key={run.id}
                    onClick={() => handleRunSelect(run.id)}
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
                            <dt className="font-mono text-[var(--nurt-t3)]">Triggered</dt>
                            <dd className="mt-1">{formatDateTime(run.triggeredAt)}</dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[var(--nurt-t3)]">Completed</dt>
                            <dd className="mt-1">{formatDateTime(run.completedAt)}</dd>
                          </div>
                        </dl>
                      </div>

                      <Activity className="size-4 shrink-0 text-[var(--nurt-t3)]" />
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

        <section aria-label="Run metrics" className="nurt-panel p-[18px_20px]">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Run metrics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedRun ? `Metrics for run #${selectedRun.id}` : 'Select a run to load metrics.'}
            </p>
          </div>

          {metricsStatus === 'idle' && (
            <div className="rounded-[12px] border border-white/[0.06] p-8 text-center text-sm text-muted-foreground">
              No run selected.
            </div>
          )}

          {metricsStatus === 'loading' && (
            <div className="rounded-[12px] border border-white/[0.06] p-6 text-sm text-muted-foreground" role="status">
              Loading run metrics...
            </div>
          )}

          {metricsStatus === 'error' && (
            <div className="rounded-[12px] border border-red-300/35 bg-red-300/10 p-4 text-sm text-red-100" role="alert">
              {metricsError ?? 'Cannot fetch evaluation metrics'}
            </div>
          )}

          {metricsStatus === 'empty' && (
            <div className="rounded-[12px] border border-white/[0.06] p-8 text-center text-sm text-muted-foreground">
              This run has no metrics yet.
            </div>
          )}

          {metricsStatus === 'success' && (
            <div className="overflow-hidden rounded-[12px] border border-white/[0.06]">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[0.06] bg-white/[0.02] text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 font-medium">Metric</th>
                    <th className="px-3 py-3 font-medium">Value</th>
                    <th className="px-3 py-3 font-medium">Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
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
      </div>
    </div>
  )
}
