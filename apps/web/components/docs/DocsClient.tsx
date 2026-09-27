'use client'

import type { Nullable } from '@workspace/codepath-common'
import { RepoCloneStatus, RepoDocsStatus, RepoEmbeddingStatus } from '@workspace/codepath-common/repository'
import { useParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'

import { assembleExportDocs, buildDocsMarkdown, getDocsFilename, getDocsFilenameWithExtension, hasStoredDocumentation } from '@/lib/docs-export'
import { getFirstRouteParam } from '@/lib/route-params'
import {
  useGenerateRepoDocsModuleMutation,
  useGenerateRepoDocsMutation,
  useGenerateRepoDocsSectionMutation,
  useGetRepoDocsModulesQuery,
  useGetRepoDocsStatusQuery,
  useRetryRepoCloneMutation,
  useRetryRepoIngestMutation
} from '@/redux/api/docsApi'
import { useGetReposQuery } from '@/redux/api/reposApi'

import { ConfirmDocsActionDialog } from './ConfirmDocsActionDialog'
import { DocsContent } from './DocsContent'
import { DocsHeader } from './DocsHeader'
import { DocsNavigation } from './DocsNavigation'
import { DocsStatusPanel } from './DocsStatusPanel'
import { type ConfirmableDocsAction, getDocsPollInterval, resolveErrorMessage } from './docsUtils'

export function DocsClient() {
  const params = useParams()

  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const validRepoId = Number.isFinite(repoId)

  const [selectedModuleKey, setSelectedModuleKey] = useState<Nullable<string>>(null)
  const [selectedSectionKey, setSelectedSectionKey] = useState<Nullable<string>>(null)
  const [actionError, setActionError] = useState<Nullable<string>>(null)
  const [generationAction, setGenerationAction] = useState<Nullable<'module' | 'repository' | 'section'>>(null)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<Nullable<ConfirmableDocsAction>>(null)
  const [pipelineAction, setPipelineAction] = useState<Nullable<'clone' | 'ingest'>>(null)

  const statusQuery = useGetRepoDocsStatusQuery(repoId, { skip: !validRepoId })

  const pollInterval = getDocsPollInterval(statusQuery.data)

  const modulesQuery = useGetRepoDocsModulesQuery(repoId, {
    pollingInterval: pollInterval,
    skip: !validRepoId
  })
  const reposQuery = useGetReposQuery(undefined, { skip: !validRepoId })

  const pollingStatusQuery = useGetRepoDocsStatusQuery(repoId, {
    pollingInterval: pollInterval,
    skip: !validRepoId
  })

  const [generateRepoDocs] = useGenerateRepoDocsMutation()
  const [generateRepoDocsModule] = useGenerateRepoDocsModuleMutation()
  const [generateRepoDocsSection] = useGenerateRepoDocsSectionMutation()
  const [retryRepoClone] = useRetryRepoCloneMutation()
  const [retryRepoIngest] = useRetryRepoIngestMutation()

  const status = pollingStatusQuery.data ?? statusQuery.data

  // Polling stops as soon as the status leaves `processing`; fetch the modules one last time so the last sections show up.
  const docsStatus = status?.docsStatus
  const previousDocsStatus = useRef(docsStatus)
  const { refetch: refetchModules } = modulesQuery

  useEffect(() => {
    if (previousDocsStatus.current === RepoDocsStatus.PROCESSING && docsStatus !== RepoDocsStatus.PROCESSING) void refetchModules()

    previousDocsStatus.current = docsStatus
  }, [docsStatus, refetchModules])
  const modules = modulesQuery.data ?? []
  const exportDocument = assembleExportDocs(modules)
  const hasGeneratedSections = exportDocument.modules.some(module => module.sections.length > 0)
  // What the destructive actions would delete is broader than what can be exported (e.g. summaries, "unknown" sections).
  const hasStoredDocs = hasStoredDocumentation(modules)
  const repositoryName = reposQuery.data?.find(repository => repository.id === repoId)?.name ?? null
  const activeModule = modules.find(module => module.key === selectedModuleKey) ?? modules[0] ?? null
  const activeSection = activeModule?.sections.find(section => section.key === selectedSectionKey) ?? activeModule?.sections[0] ?? null
  const isLoading = statusQuery.isLoading || modulesQuery.isLoading
  const isRefreshing = statusQuery.isFetching || modulesQuery.isFetching
  const queryError = statusQuery.error ?? modulesQuery.error
  const error = !validRepoId ? 'Invalid repository identifier' : actionError ?? (queryError ? resolveErrorMessage(queryError) : null)
  const canGenerate = status?.cloneStatus === RepoCloneStatus.CLONED
      && status.embeddingStatus === RepoEmbeddingStatus.EMBEDDED
      && status.docsStatus !== RepoDocsStatus.PROCESSING
  const canRetryClone = status ? status.cloneStatus !== RepoCloneStatus.CLONING : false
  const canRetryIngest = status ? status.cloneStatus === RepoCloneStatus.CLONED : false

  const refresh = () => {
    setActionError(null)
    void Promise.all([statusQuery.refetch(), modulesQuery.refetch()])
  }
  const generate = async (scope: 'module' | 'repository' | 'section') => {
    if (!validRepoId || (scope !== 'repository' && !activeModule) || (scope === 'section' && !activeSection)) return

    setActionError(null)
    setGenerationAction(scope)

    try {
      if (scope === 'section' && activeModule && activeSection) await generateRepoDocsSection({ moduleKey: activeModule.key, repoId, sectionKey: activeSection.key }).unwrap()
      else if (scope === 'module' && activeModule) await generateRepoDocsModule({ moduleKey: activeModule.key, repoId }).unwrap()
      else await generateRepoDocs(repoId).unwrap()
    } catch (nextError) {
      setActionError(resolveErrorMessage(nextError))
    } finally {
      setGenerationAction(null)
    }
  }
  const retryPipeline = async (action: 'clone' | 'ingest') => {
    if (!validRepoId) return

    setActionError(null)
    setPipelineAction(action)

    try {
      await (action === 'clone' ? retryRepoClone(repoId).unwrap() : retryRepoIngest(repoId).unwrap())

      setSelectedModuleKey(null)
      setSelectedSectionKey(null)
      refresh()
    } catch (nextError) {
      setActionError(resolveErrorMessage(nextError))
    } finally {
      setPipelineAction(null)
    }
  }
  const requestDestructiveAction = (action: ConfirmableDocsAction) => {
    // Nothing to lose when no documentation has been generated yet, so the action runs without asking.
    if (hasStoredDocs) setPendingConfirmation(action)
    else void runDestructiveAction(action)
  }
  const runDestructiveAction = async (action: ConfirmableDocsAction) => {
    setPendingConfirmation(null)

    if (action === 'generate') await generate('repository')
    else await retryPipeline(action)
  }
  const exportMarkdown = () => {
    if (!hasGeneratedSections) return

    const content = buildDocsMarkdown(exportDocument, repositoryName ?? `Repository ${repoId}`)
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')

    link.download = getDocsFilename(repositoryName, repoId)
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }
  const exportPdf = async () => {
    if (!hasGeneratedSections) return

    setActionError(null)
    setIsExportingPdf(true)

    try {
      const { buildDocsPdf, downloadPdf } = await import('@/lib/docs-pdf')
      const blob = await buildDocsPdf(exportDocument, { repoId, repositoryName: repositoryName ?? `Repository ${repoId}` })

      downloadPdf(blob, getDocsFilenameWithExtension(repositoryName, repoId, 'pdf'))
    } catch (nextError) {
      setActionError(resolveErrorMessage(nextError))
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="space-y-4.5">
      <DocsHeader
        canExportDocs={hasGeneratedSections}
        canGenerate={canGenerate}
        canRetryClone={canRetryClone}
        canRetryIngest={canRetryIngest}
        hasActiveModule={Boolean(activeModule)}
        hasActiveSection={Boolean(activeSection)}
        isExportingPdf={isExportingPdf}
        isGenerating={generationAction !== null}
        isPipelineActionRunning={pipelineAction !== null}
        isRefreshing={isRefreshing}
        onExportMarkdown={exportMarkdown}
        onExportPdf={() => void exportPdf()}
        onGenerate={scope => scope === 'repository' ? requestDestructiveAction('generate') : void generate(scope)}
        onRefresh={refresh}
        onRetryClone={() => requestDestructiveAction('clone')}
        onRetryIngest={() => requestDestructiveAction('ingest')}
        pipelineAction={pipelineAction}
        repoId={repoId}
        runningGeneration={generationAction}
      />

      <ConfirmDocsActionDialog
        action={pendingConfirmation}
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={() => pendingConfirmation && void runDestructiveAction(pendingConfirmation)}
      />

      <DocsStatusPanel status={status} />

      <div className="flex min-h-120 gap-4">
        <DocsNavigation
          activeModule={activeModule}
          activeSection={activeSection}
          modules={modules}
          onModuleSelect={module => {
            setSelectedModuleKey(module.key)
            setSelectedSectionKey(module.sections[0]?.key ?? null)
          }}
          onSectionSelect={section => setSelectedSectionKey(section.key)}
          status={status?.docsStatus}
        />

        <DocsContent
          activeModule={activeModule}
          activeSection={activeSection}
          error={error}
          isLoading={isLoading}
          status={status?.docsStatus}
        />
      </div>
    </div>
  )
}
