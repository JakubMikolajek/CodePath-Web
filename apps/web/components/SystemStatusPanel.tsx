'use client'

import { Button } from '@workspace/ui/components/button'
import { Activity, CheckCircle2, Clock3, RefreshCw, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  getSystemStatus,
  type RabbitQueueGroupStatus,
  type SystemComponentStatus,
  type SystemStatusResponse
} from '@/lib/system-status'

const STATUS_REFRESH_INTERVAL_MS = 10_000

const statusLabel = {
  degraded: 'Degraded',
  down: 'Down',
  ok: 'Operational'
} as const

const statusTone = {
  degraded: 'border-amber-300/30 bg-amber-300/15 text-amber-100',
  down: 'border-red-400/30 bg-red-400/15 text-red-200',
  ok: 'border-emerald-300/30 bg-emerald-300/15 text-emerald-100'
} as const

const dotTone = {
  degraded: 'bg-amber-300',
  down: 'bg-red-300',
  ok: 'bg-emerald-300'
} as const

function StatusIcon({ status }: Pick<SystemComponentStatus, 'status'>) {
  if (status === 'ok') return <CheckCircle2 className="size-4 text-emerald-300" />
  if (status === 'degraded') return <Clock3 className="size-4 text-amber-300" />
  return <TriangleAlert className="size-4 text-red-300" />
}

function QueueMetric({ label, value }: { label: string, value: number }) {
  return (
    <span className="rounded-[7px] border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] leading-none text-muted-foreground">
      {label}: <span className="font-semibold text-white">{value}</span>
    </span>
  )
}

function RabbitQueueRow({ queue }: { queue: RabbitQueueGroupStatus }) {
  const hasBlockedMain = queue.main.consumers < 1
  const hasFailures = queue.retry.messages > 0 || queue.dlq.messages > 0

  return (
    <div className="rounded-[11px] border border-white/[0.06] bg-white/[0.015] px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dotTone[queue.status]}`} />
          <span className="truncate text-xs font-semibold text-white">{queue.name}</span>
        </div>

        {(hasBlockedMain || hasFailures) && (
          <span className={`rounded-[7px] border px-2 py-1 text-[10px] font-medium ${statusTone[queue.status]}`}>
            {hasBlockedMain ? 'No consumer' : 'Needs review'}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <QueueMetric label="cons" value={queue.main.consumers} />
        <QueueMetric label="ready" value={queue.main.ready} />
        <QueueMetric label="unack" value={queue.main.unacknowledged} />
        <QueueMetric label="retry" value={queue.retry.messages} />
        <QueueMetric label="dlq" value={queue.dlq.messages} />
      </div>
    </div>
  )
}

export function SystemStatusPanel() {
  const [error, setError] = useState<null | string>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [status, setStatus] = useState<null | SystemStatusResponse>(null)

  const loadStatus = useCallback(async () => {
    setError(null)
    setIsLoading(true)

    try {
      setStatus(await getSystemStatus())
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Cannot load system status')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStatus()

    const interval = setInterval(() => {
      void loadStatus()
    }, STATUS_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [loadStatus])

  const sortedComponents = useMemo(() => {
    const rank = { degraded: 1, down: 0, ok: 2 }
    return [...(status?.components ?? [])].sort((a, b) => rank[a.status] - rank[b.status] || a.name.localeCompare(b.name))
  }, [status?.components])

  return (
    <section aria-label="Service status" className="nurt-panel p-[18px_20px]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-secondary" />
            <h2 className="text-[14.5px] font-semibold text-foreground">Service status</h2>
          </div>

          <p className="mt-px text-[11px] text-[var(--nurt-t3)]">
            {status ? `Last check ${new Date(status.checkedAt).toLocaleTimeString()}` : 'Checking runtime dependencies'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status && (
            <span className={`rounded-[7px] border px-[9px] py-[3px] font-mono text-[10.5px] ${statusTone[status.status]}`}>
              {statusLabel[status.status]}
            </span>
          )}

          <Button className="rounded-[8px] text-xs" disabled={isLoading} onClick={loadStatus} size="sm" type="button" variant="glass">
            <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-[11px] border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100" role="alert">
          {error}
        </div>
      )}

      {!error && sortedComponents.length === 0 && (
        <div className="rounded-[11px] border border-white/[0.06] bg-white/[0.015] px-4 py-4 text-sm text-muted-foreground" role="status">
          Loading service checks...
        </div>
      )}

      {!error && sortedComponents.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedComponents.map(component => (
            <div className="rounded-[11px] border border-white/[0.06] bg-white/[0.015] px-[14px] py-[13px]" key={component.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`size-[7px] shrink-0 rounded-full ${dotTone[component.status]}`} />
                    <p className="text-[13px] font-semibold text-foreground">{component.name}</p>
                  </div>

                  <p className="mt-[7px] line-clamp-2 min-h-[30px] text-[11px] leading-[1.4] text-[var(--nurt-t3)]">{component.message}</p>
                </div>

                <StatusIcon status={component.status} />
              </div>

              <div className="mt-[7px] flex items-center justify-between gap-3 font-mono text-[10.5px] text-[var(--nurt-t3)]">
                <span>{component.latencyMs}ms</span>
                <span className="capitalize">{component.status}</span>
              </div>

              {component.queues && component.queues.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {component.queues.map(queue => (
                    <RabbitQueueRow key={queue.name} queue={queue} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
