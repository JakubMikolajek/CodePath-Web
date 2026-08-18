import type { Nullable } from '@workspace/codepath-common'
import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'

import type { EvaluationTrendPoint } from '@/lib/evaluations'

import {
  formatDateTime,
  formatMetricValue,
  formatShortDateTime,
  LINE_COLORS
} from './evaluationUtils'

interface TrendChartRow {
  [metricKey: string]: number | string
  label: string
  timestamp: number
}

interface EvaluationTrendPanelProps {
  error: Nullable<string>
  isError: boolean
  isLoading: boolean
  trend: EvaluationTrendPoint[]
}

export function EvaluationTrendPanel({ error, isError, isLoading, trend }: EvaluationTrendPanelProps) {
  const metricKeys = useMemo(() => new Map(trend.map((point, index) => [point.metricName, `metric_${index}`])), [trend])
  const trendChartRows = useMemo(() => {
    const rowsByTimestamp = new Map<number, TrendChartRow>()

    for (const point of trend) {
      const metricKey = metricKeys.get(point.metricName)

      if (!metricKey || !Number.isFinite(point.averageMetricValue)) continue

      const timestamps = [point.firstMetricAt, point.lastMetricAt]
        .map(value => value ? Date.parse(value) : Number.NaN)
        .filter(value => Number.isFinite(value))

      for (const timestamp of [...new Set(timestamps)]) {
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

    return min === max ? [min - 60_000, max + 60_000] : [min, max]
  }, [trendChartRows])

  return (
    <section aria-label="Metric trend" className="nurt-panel p-[18px_20px]">
      <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Metric trend</h2>

          <p className="mt-1 text-sm text-muted-foreground">Aggregate metric values over the sampled metric time range.</p>
        </div>

        <span className="font-mono text-xs text-(--nurt-t3)">{trend.length} metric{trend.length === 1 ? '' : 's'}</span>
      </div>

      {isLoading && (
        <div className="rounded-[12px] border border-white/6 p-6 text-sm text-muted-foreground" role="status">
          Loading metric trend...
        </div>
      )}

      {isError && (
        <div className="rounded-[12px] border border-red-300/35 bg-red-300/10 p-4 text-sm text-red-100" role="alert">
          {error ?? 'Cannot fetch evaluation trend'}
        </div>
      )}

      {!isLoading && !isError && trend.length === 0 && (
        <div className="rounded-[12px] border border-white/6 p-8 text-center text-sm text-muted-foreground">
          No metric trend data is available yet.
        </div>
      )}

      {!isLoading && !isError && trend.length > 0 && trendChartRows.length === 0 && (
        <div className="rounded-[12px] border border-amber-300/35 bg-amber-300/10 p-4 text-sm text-amber-100">
          Trend metrics exist, but none include valid timestamps for charting.
        </div>
      )}

      {!isLoading && !isError && trendChartRows.length > 0 && (
        <>
          <div className="h-80 rounded-[12px] border border-white/6 bg-(--nurt-bg0) p-3">
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
                  formatter={(value, name) => [formatMetricValue(Number(value)), String(name)]}
                  labelFormatter={label => formatDateTime(new Date(Number(label)).toISOString())}
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
              <div className="rounded-xl border border-white/6 bg-white/1.5 p-3" key={point.metricName}>
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
  )
}
