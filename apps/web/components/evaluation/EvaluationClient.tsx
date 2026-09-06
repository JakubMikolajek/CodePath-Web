'use client'

import type { Nullable } from '@workspace/codepath-common'
import { Button } from '@workspace/ui/components/button'
import { FlaskConical, RefreshCcw } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/PageHeader'
import type { EvaluationRunType } from '@/lib/evaluations'
import { getFirstRouteParam } from '@/lib/route-params'
import {
  useGetRepoEvaluationRunsQuery,
  useGetRepoEvaluationTrendQuery,
  useGetRunMetricsQuery,
  useTriggerEvaluationRunMutation
} from '@/redux/api/evaluationApi'

import { EvaluationRunMetricsPanel } from './EvaluationRunMetricsPanel'
import { EvaluationRunsPanel } from './EvaluationRunsPanel'
import { EvaluationTrendPanel } from './EvaluationTrendPanel'
import { EvaluationTriggerPanel } from './EvaluationTriggerPanel'
import { errorMessage } from './evaluationUtils'

export function EvaluationClient() {
  const params = useParams()

  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const validRepoId = Number.isFinite(repoId)

  const [runType, setRunType] = useState<EvaluationRunType>('docs_quality')
  const [selectedRunId, setSelectedRunId] = useState<Nullable<number>>(null)

  const runsQuery = useGetRepoEvaluationRunsQuery({
    repoId
  }, {
    skip: !validRepoId
  })

  const trendQuery = useGetRepoEvaluationTrendQuery(repoId, {
    skip: !validRepoId
  })

  const metricsQuery = useGetRunMetricsQuery({
    repoId, runId: selectedRunId ?? 0
  }, {
    skip: !validRepoId || selectedRunId === null
  }
  )
  const [triggerEvaluationRun, triggerState] = useTriggerEvaluationRunMutation()

  const runs = runsQuery.data ?? []
  const trend = trendQuery.data ?? []
  const metrics = metricsQuery.data ?? []
  const selectedRun = runs.find(run => run.id === selectedRunId) ?? null

  const refreshEvaluationData = () => {
    if (!validRepoId) return

    void runsQuery.refetch()
    void trendQuery.refetch()

    if (selectedRunId !== null) void metricsQuery.refetch()
  }

  const handleTrigger = () => {
    if (!validRepoId) return

    void triggerEvaluationRun({ repoId, runType })
  }

  return (
    <div className="space-y-3.5">
      <PageHeader
        actions={(
          <>
            <Button
              className="rounded-[9px] px-3.25 py-2 text-[12.5px]"
              onClick={refreshEvaluationData}
              type="button"
              variant="glass"
            >
              <RefreshCcw className="size-4" />
              Refresh
            </Button>

            <Button
              className="rounded-[9px] px-3.5 py-2 text-[12.5px]"
              disabled={triggerState.isLoading}
              onClick={handleTrigger}
              type="button"
              variant="glow"
            >
              <FlaskConical className="size-4" />
              {triggerState.isLoading ? 'Queueing...' : 'Run evaluation'}
            </Button>
          </>
        )}
        description="Review evaluation runs, metrics and aggregate metric trends"
        eyebrow={`Repo ${validRepoId ? repoId : 'unknown'}`}
        title="Evaluation Worker"
      />

      <EvaluationTriggerPanel
        error={triggerState.isError ? errorMessage(triggerState.error, 'Cannot trigger evaluation run') : null}
        isLoading={triggerState.isLoading}
        message={triggerState.isSuccess ? triggerState.data?.message ?? null : null}
        onRunTypeChange={setRunType}
        runType={runType}
      />

      <EvaluationTrendPanel
        error={trendQuery.isError ? errorMessage(trendQuery.error, 'Cannot fetch evaluation trend') : null}
        isError={trendQuery.isError}
        isLoading={trendQuery.isLoading}
        trend={trend}
      />

      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <EvaluationRunsPanel
          error={runsQuery.isError ? errorMessage(runsQuery.error, 'Cannot fetch evaluation runs') : null}
          isError={runsQuery.isError}
          isLoading={runsQuery.isLoading}
          onSelect={setSelectedRunId}
          runs={runs}
          selectedRunId={selectedRunId}
        />

        <EvaluationRunMetricsPanel
          error={metricsQuery.isError ? errorMessage(metricsQuery.error, 'Cannot fetch evaluation metrics') : null}
          isError={metricsQuery.isError}
          isLoading={metricsQuery.isLoading}
          metrics={metrics}
          selectedRun={selectedRun}
        />
      </div>
    </div>
  )
}
