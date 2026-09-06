import { Button } from '@workspace/ui/components/button'
import { BookOpen, FileText, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'

import { PageHeader } from '@/components/PageHeader'

interface DocsHeaderProps {
  canGenerate: boolean;
  canRetryClone: boolean;
  canRetryIngest: boolean;
  hasActiveModule: boolean;
  hasActiveSection: boolean;
  isGenerating: boolean;
  isPipelineActionRunning: boolean;
  isRefreshing: boolean;
  onGenerate: (scope: 'module' | 'repository' | 'section') => void;
  onRefresh: () => void;
  onRetryClone: () => void;
  onRetryIngest: () => void;
  pipelineAction: 'clone' | 'ingest' | null;
  repoId: number;
  runningGeneration: 'module' | 'repository' | 'section' | null;
}

export function DocsHeader({
  canGenerate,
  canRetryClone,
  canRetryIngest,
  hasActiveModule,
  hasActiveSection,
  isGenerating,
  isPipelineActionRunning,
  isRefreshing,
  onGenerate,
  onRefresh,
  onRetryClone,
  onRetryIngest,
  pipelineAction,
  repoId,
  runningGeneration
}: DocsHeaderProps) {
  return (
    <PageHeader
      actions={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            className="rounded-[8px] px-2.75 py-1.5 text-[11.5px]"
            disabled={!canRetryClone || isPipelineActionRunning || isGenerating}
            onClick={onRetryClone}
            type="button"
            variant="glass"
          >
            <RotateCcw className="size-4" />

            {pipelineAction === 'clone' ? 'Restarting...' : 'Restart clone'}
          </Button>

          <Button
            className="rounded-[8px] px-2.75 py-1.5 text-[11.5px]"
            disabled={!canRetryIngest || isPipelineActionRunning || isGenerating}
            onClick={onRetryIngest}
            type="button"
            variant="glass"
          >
            <RefreshCw className="size-4" />

            {pipelineAction === 'ingest' ? 'Restarting...' : 'Restart ingest'}
          </Button>

          <Button
            className="rounded-[8px] px-2.75 py-1.5 text-[11.5px]"
            disabled={!canGenerate || isGenerating || isPipelineActionRunning}
            onClick={() => onGenerate('repository')}
            type="button"
            variant="glow"
          >
            <Sparkles className="size-4" />

            {runningGeneration === 'repository' ? 'Starting...' : 'Generate docs'}
          </Button>

          <Button
            className="rounded-[8px] px-2.75 py-1.5 text-[11.5px]"
            disabled={!canGenerate || !hasActiveModule || isGenerating || isPipelineActionRunning}
            onClick={() => onGenerate('module')}
            type="button"
            variant="glass"
          >
            <BookOpen className="size-4" />

            {runningGeneration === 'module' ? 'Starting...' : 'Regenerate module'}
          </Button>

          <Button
            className="rounded-[8px] px-2.75 py-1.5 text-[11.5px]"
            disabled={!canGenerate || !hasActiveModule || !hasActiveSection || isGenerating || isPipelineActionRunning}
            onClick={() => onGenerate('section')}
            type="button"
            variant="glass"
          >
            <FileText className="size-4" />

            {runningGeneration === 'section' ? 'Starting...' : 'Regenerate section'}
          </Button>

          <Button
            className="rounded-[8px] px-2.75 py-1.5 text-[11.5px]"
            disabled={isRefreshing || isPipelineActionRunning || isGenerating}
            onClick={onRefresh}
            type="button"
            variant="glass"
          >
            <RefreshCw className="size-4" />

            Refresh
          </Button>
        </div>
      )}
      description="Generated technical documentation for repository architecture, API surface and implementation notes."
      eyebrow={`Repo ${Number.isFinite(repoId) ? repoId : 'unknown'}`}
      title="Docs"
    />
  )
}
