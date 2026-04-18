import type { TelemetryEventV1 } from '@workspace/codepath-common/telemetry'

type LabelValues = Record<string, string | undefined>

interface CounterDefinition {
  help: string
  labelNames: readonly string[]
  name: string
}

interface CounterSeries {
  labels: Record<string, string>
  value: number
}

interface HistogramDefinition {
  buckets: readonly number[]
  help: string
  labelNames: readonly string[]
  name: string
}

interface HistogramSeries {
  bucketCounts: number[]
  count: number
  labels: Record<string, string>
  sum: number
}

const DEFAULT_HISTOGRAM_BUCKETS_MS = [25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 30_000, 60_000] as const

const COUNTER_DEFINITIONS: readonly CounterDefinition[] = [
  {
    help: 'Total scheduled queue retries from telemetry events.',
    labelNames: ['service', 'queue'],
    name: 'codepath_queue_retry_total'
  },
  {
    help: 'Total messages moved to DLQ from telemetry events.',
    labelNames: ['service', 'queue'],
    name: 'codepath_queue_dlq_total'
  },
  {
    help: 'Total chat RPC timeouts from telemetry events.',
    labelNames: ['service'],
    name: 'codepath_chat_rpc_timeout_total'
  }
]

const HISTOGRAM_DEFINITIONS: readonly HistogramDefinition[] = [
  {
    buckets: DEFAULT_HISTOGRAM_BUCKETS_MS,
    help: 'Chat request duration in milliseconds from telemetry events.',
    labelNames: ['service'],
    name: 'codepath_chat_rpc_duration_ms'
  },
  {
    buckets: DEFAULT_HISTOGRAM_BUCKETS_MS,
    help: 'Documentation generation duration in milliseconds from telemetry events.',
    labelNames: ['service'],
    name: 'codepath_docs_generation_duration_ms'
  }
]

const counters = new Map<string, Map<string, CounterSeries>>()
const histograms = new Map<string, Map<string, HistogramSeries>>()

function escapeLabel(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('"', '\\"')
}

function normalizeLabelValue(value: string | undefined): string {
  if (!value) {
    return 'unknown'
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : 'unknown'
}

function normalizeLabels(labelNames: readonly string[], values: LabelValues): Record<string, string> {
  return Object.fromEntries(
    // eslint-disable-next-line security/detect-object-injection -- label names are statically defined in metric declarations.
    labelNames.map(labelName => [labelName, normalizeLabelValue(values[labelName])])
  ) as Record<string, string>
}

function seriesKey(labelNames: readonly string[], labels: Record<string, string>): string {
  // eslint-disable-next-line security/detect-object-injection -- label names are static and validated by normalizeLabels.
  return labelNames.map(labelName => `${labelName}:${labels[labelName]}`).join('|')
}

function getCounterDefinition(name: string): CounterDefinition | undefined {
  return COUNTER_DEFINITIONS.find(definition => definition.name === name)
}

function getHistogramDefinition(name: string): HistogramDefinition | undefined {
  return HISTOGRAM_DEFINITIONS.find(definition => definition.name === name)
}

function incrementCounter(name: string, values: LabelValues, amount = 1): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    return
  }

  const definition = getCounterDefinition(name)
  if (!definition) {
    return
  }

  const labels = normalizeLabels(definition.labelNames, values)
  const key = seriesKey(definition.labelNames, labels)
  const metricSeries = counters.get(name) ?? new Map<string, CounterSeries>()
  const existing = metricSeries.get(key)

  if (existing) {
    existing.value += amount
  } else {
    metricSeries.set(key, {
      labels,
      value: amount
    })
  }

  counters.set(name, metricSeries)
}

function observeHistogram(name: string, values: LabelValues, rawValue: number): void {
  if (!Number.isFinite(rawValue) || rawValue < 0) {
    return
  }

  const definition = getHistogramDefinition(name)
  if (!definition) {
    return
  }

  const labels = normalizeLabels(definition.labelNames, values)
  const key = seriesKey(definition.labelNames, labels)
  const metricSeries = histograms.get(name) ?? new Map<string, HistogramSeries>()
  const existing = metricSeries.get(key) ?? {
    bucketCounts: definition.buckets.map(() => 0),
    count: 0,
    labels,
    sum: 0
  }

  for (const [index, bucket] of definition.buckets.entries()) {
    if (rawValue <= bucket) {
      // eslint-disable-next-line security/detect-object-injection -- index comes from iterating known bucket array.
      existing.bucketCounts[index] += 1
      break
    }
  }

  existing.count += 1
  existing.sum += rawValue
  metricSeries.set(key, existing)
  histograms.set(name, metricSeries)
}

function renderLabelSet(labels: Record<string, string>): string {
  const entries = Object.entries(labels)
  if (entries.length === 0) {
    return ''
  }

  const formatted = entries
    .map(([label, value]) => `${label}="${escapeLabel(value)}"`)
    .join(',')

  return `{${formatted}}`
}

function renderCounterSamples(definition: CounterDefinition): string[] {
  const metricSeries = counters.get(definition.name)
  if (!metricSeries) {
    return []
  }

  return Array.from(metricSeries.values())
    .map(sample => `${definition.name}${renderLabelSet(sample.labels)} ${sample.value}`)
    .sort()
}

function renderHistogramSamples(definition: HistogramDefinition): string[] {
  const metricSeries = histograms.get(definition.name)
  if (!metricSeries) {
    return []
  }

  return Array.from(metricSeries.values())
    .flatMap(sample => {
      const baseLabels = sample.labels
      const lines: string[] = []
      let cumulative = 0

      for (const [index, bucket] of definition.buckets.entries()) {
        // eslint-disable-next-line security/detect-object-injection -- index comes from iterating known bucket array.
        cumulative += sample.bucketCounts[index]
        lines.push(
          `${definition.name}_bucket${renderLabelSet({
            ...baseLabels,
            le: String(bucket)
          })} ${cumulative}`
        )
      }

      lines.push(
        `${definition.name}_bucket${renderLabelSet({
          ...baseLabels,
          le: '+Inf'
        })} ${sample.count}`
      )
      lines.push(`${definition.name}_sum${renderLabelSet(baseLabels)} ${sample.sum}`)
      lines.push(`${definition.name}_count${renderLabelSet(baseLabels)} ${sample.count}`)
      return lines
    })
    .sort()
}

export function recordTelemetryMetric(event: TelemetryEventV1): void {
  const service = event.service
  const queue = event.queueName ?? 'unknown'

  switch (event.event) {
    case 'queue_retry_scheduled':
      incrementCounter('codepath_queue_retry_total', { queue, service })
      return
    case 'queue_message_moved_to_dlq':
      incrementCounter('codepath_queue_dlq_total', { queue, service })
      return
    case 'chat_rpc_timeout':
      incrementCounter('codepath_chat_rpc_timeout_total', { service })
      return
    case 'chat_rpc_response_received':
    case 'chat_response_published':
      if (typeof event.durationMs === 'number') {
        observeHistogram('codepath_chat_rpc_duration_ms', { service }, event.durationMs)
      }
      return
    case 'docs_generation_completed':
      if (typeof event.durationMs === 'number') {
        observeHistogram('codepath_docs_generation_duration_ms', { service }, event.durationMs)
      }
      return
    default:
      return
  }
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = []

  for (const definition of COUNTER_DEFINITIONS) {
    lines.push(`# HELP ${definition.name} ${definition.help}`)
    lines.push(`# TYPE ${definition.name} counter`)
    lines.push(...renderCounterSamples(definition))
  }

  for (const definition of HISTOGRAM_DEFINITIONS) {
    lines.push(`# HELP ${definition.name} ${definition.help}`)
    lines.push(`# TYPE ${definition.name} histogram`)
    lines.push(...renderHistogramSamples(definition))
  }

  return `${lines.join('\n')}\n`
}

export function resetPrometheusMetricsForTests(): void {
  counters.clear()
  histograms.clear()
}
