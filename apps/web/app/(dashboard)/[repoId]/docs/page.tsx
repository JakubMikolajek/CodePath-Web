'use client'

import { RepoCloneStatus, RepoDocsStatus, RepoEmbeddingStatus } from '@workspace/codepath-common'
import type { Nullable } from '@workspace/codepath-common/globals'
import type { RepoDocsModule, RepoDocsSection } from '@workspace/codepath-common/repository'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { BookOpen, CheckCircle2, Clock3, FileText, RefreshCw, RotateCcw, Sparkles, TriangleAlert } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import { PageHeader } from '@/components/PageHeader'
import {
  generateRepoDocs,
  generateRepoDocsModule,
  generateRepoDocsSection,
  getRepoDocsModules,
  getRepoDocsStatus,
  type RepoDocsStatusResponse
} from '@/lib/docs'
import { retryRepoClone, retryRepoIngest } from '@/lib/repos/client'
import { getFirstRouteParam } from '@/lib/route-params'

const DOCS_STATUS_POLL_MS = 5_000

const resolveErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const responseData = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message

    if (Array.isArray(responseData)) return responseData.join(', ')
    if (typeof responseData === 'string') return responseData
  }

  if (error instanceof Error) return error.message

  return 'Unexpected error'
}

const formatStatus = (status: string) => status.replaceAll('_', ' ')

const formatDateTime = (value: Nullable<string>) => {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

const describeDocsNode = (input: {
  error?: Nullable<string>
  generatedAt: Nullable<string>
  status: RepoDocsStatus
  title: string
}) => {
  const generatedAt = formatDateTime(input.generatedAt)
  const parts = [
    input.title,
    `status: ${formatStatus(input.status)}`,
    generatedAt ? `generated: ${generatedAt}` : null,
    input.error ? `error: ${input.error}` : null
  ].filter(Boolean)

  return parts.join(' · ')
}

const formatDocsProgress = (status: RepoDocsStatusResponse) => {
  const progress = status.docsProgress
  if (!progress) return null

  const parts = [
    progress.scope ? `scope: ${formatStatus(progress.scope)}` : null,
    progress.moduleKey ? `module: ${progress.moduleKey}` : null,
    progress.sectionKey ? `section: ${formatStatus(progress.sectionKey)}` : null
  ].filter(Boolean)
  const counter = progress.current !== null && progress.total !== null
    ? `${progress.current}/${progress.total}`
    : null

  return {
    counter,
    details: parts.join(' · '),
    message: progress.message,
    stage: progress.stage ? formatStatus(progress.stage) : null
  }
}

const isPipelineWaitingOrRunning = (status: RepoDocsStatusResponse) => (
  status.cloneStatus === RepoCloneStatus.PENDING
  || status.cloneStatus === RepoCloneStatus.CLONING
  || status.embeddingStatus === RepoEmbeddingStatus.PENDING
  || status.embeddingStatus === RepoEmbeddingStatus.PROCESSING
  || status.docsStatus === RepoDocsStatus.PROCESSING
)

const getStatusTone = (status?: string) => {
  if (status === 'ready' || status === 'embedded' || status === 'cloned') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
  if (status === 'processing') return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
  if (status === 'failed') return 'border-red-400/30 bg-red-400/10 text-red-200'

  return 'border-white/10 bg-white/5 text-muted-foreground'
}

export default function Page() {
  const params = useParams()

  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])

  const [error, setError] = useState<Nullable<string>>(null)
  const [generationAction, setGenerationAction] = useState<Nullable<'module' | 'repository' | 'section'>>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [modules, setModules] = useState<RepoDocsModule[]>([])
  const [pipelineAction, setPipelineAction] = useState<Nullable<'clone' | 'ingest'>>(null)
  const [selectedModuleKey, setSelectedModuleKey] = useState<Nullable<RepoDocsModule['key']>>(null)
  const [selectedSectionKey, setSelectedSectionKey] = useState<Nullable<RepoDocsSection['key']>>(null)
  const [status, setStatus] = useState<Nullable<RepoDocsStatusResponse>>(null)

  const fetchModules = useCallback(async () => {
    if (!Number.isFinite(repoId)) return

    const nextModules = await getRepoDocsModules(repoId)
    const nextModule = selectedModuleKey
      ? nextModules.find(module => module.key === selectedModuleKey) ?? nextModules[0]
      : nextModules[0]

    setModules(nextModules)

    if (!selectedModuleKey || !nextModules.some(module => module.key === selectedModuleKey)) {
      setSelectedModuleKey(nextModule?.key ?? null)
    }

    if (!selectedSectionKey || !nextModule?.sections.some(section => section.key === selectedSectionKey)) {
      setSelectedSectionKey(nextModule?.sections[0]?.key ?? null)
    }
  }, [repoId, selectedModuleKey, selectedSectionKey])

  const fetchStatus = useCallback(async () => {
    if (!Number.isFinite(repoId)) return null

    const nextStatus = await getRepoDocsStatus(repoId)
    setStatus(nextStatus)
    return nextStatus
  }, [repoId])

  const loadPageState = useCallback(async () => {
    if (!Number.isFinite(repoId)) {
      setError('Invalid repository identifier')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const nextStatus = await fetchStatus()

      if (nextStatus) await fetchModules()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }, [fetchModules, fetchStatus, repoId])

  const handleGenerate = async (scope: 'module' | 'repository' | 'section' = 'repository') => {
    if (!Number.isFinite(repoId)) return
    if (scope !== 'repository' && !activeModule) return
    if (scope === 'section' && !activeSection) return

    setGenerationAction(scope)
    setError(null)

    try {
      if (scope === 'section' && activeModule && activeSection) {
        await generateRepoDocsSection(repoId, activeModule.key, activeSection.key)
      } else if (scope === 'module' && activeModule) {
        await generateRepoDocsModule(repoId, activeModule.key)
      } else {
        await generateRepoDocs(repoId)
      }

      const nextStatus = await fetchStatus()

      if (nextStatus) await fetchModules()
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setGenerationAction(null)
    }
  }

  const handleRetryClone = async () => {
    if (!Number.isFinite(repoId)) return

    setPipelineAction('clone')
    setError(null)

    try {
      const nextStatus = await retryRepoClone(repoId)
      setStatus({ ...nextStatus, docsProgress: null })
      setModules([])
      setSelectedModuleKey(null)
      setSelectedSectionKey(null)
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setPipelineAction(null)
    }
  }

  const handleRetryIngest = async () => {
    if (!Number.isFinite(repoId)) return

    setPipelineAction('ingest')
    setError(null)

    try {
      const nextStatus = await retryRepoIngest(repoId)
      setStatus({ ...nextStatus, docsProgress: null })
      setModules([])
      setSelectedModuleKey(null)
      setSelectedSectionKey(null)
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setPipelineAction(null)
    }
  }

  useEffect(() => {
    void loadPageState()
  }, [loadPageState])

  useEffect(() => {
    if (!Number.isFinite(repoId) || !status || !isPipelineWaitingOrRunning(status)) return

    const interval = setInterval(() => {
      void (async () => {
        try {
          const nextStatus = await fetchStatus()

          if (nextStatus) await fetchModules()
        } catch (nextError) {
          setError(resolveErrorMessage(nextError))
        }
      })()
    }, DOCS_STATUS_POLL_MS)

    return () => clearInterval(interval)
  }, [fetchModules, fetchStatus, repoId, status])

  const canGenerate = status
    ? status.cloneStatus === RepoCloneStatus.CLONED
    && status.embeddingStatus === RepoEmbeddingStatus.EMBEDDED
    && status.docsStatus !== RepoDocsStatus.PROCESSING
    : false
  const canRetryClone = status ? status.cloneStatus !== RepoCloneStatus.CLONING : false
  const canRetryIngest = status ? status.cloneStatus === RepoCloneStatus.CLONED : false
  const isPipelineActionRunning = pipelineAction !== null
  const isGenerating = generationAction !== null

  const statusItems = status ? [
    { label: 'Clone', value: status.cloneStatus },
    { label: 'Embeddings', value: status.embeddingStatus },
    { label: 'Docs', value: status.docsStatus }
  ] : []
  const activeModule = modules.find(module => module.key === selectedModuleKey) ?? modules[0] ?? null
  const activeSections = activeModule?.sections ?? []
  const activeSection = activeSections.find(section => section.key === selectedSectionKey) ?? activeSections[0] ?? null
  const activeMarkdown = activeSection?.markdown?.trim() ?? ''
  const docsProgress = status ? formatDocsProgress(status) : null

  return (
    <div className="space-y-6">
      <PageHeader
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button disabled={!canRetryClone || isPipelineActionRunning || isGenerating} onClick={handleRetryClone} type="button" variant="glass">
              <RotateCcw className="size-4" />
              {pipelineAction === 'clone' ? 'Restarting...' : 'Restart clone'}
            </Button>

            <Button disabled={!canRetryIngest || isPipelineActionRunning || isGenerating} onClick={handleRetryIngest} type="button" variant="glass">
              <RefreshCw className="size-4" />
              {pipelineAction === 'ingest' ? 'Restarting...' : 'Restart ingest'}
            </Button>

            <Button disabled={!canGenerate || isGenerating || isPipelineActionRunning} onClick={() => handleGenerate('repository')} type="button" variant="glow">
              <Sparkles className="size-4" />
              {generationAction === 'repository' ? 'Starting...' : 'Generate docs'}
            </Button>

            <Button disabled={!canGenerate || !activeModule || isGenerating || isPipelineActionRunning} onClick={() => handleGenerate('module')} type="button" variant="glass">
              <BookOpen className="size-4" />
              {generationAction === 'module' ? 'Starting...' : 'Regenerate module'}
            </Button>

            <Button disabled={!canGenerate || !activeModule || !activeSection || isGenerating || isPipelineActionRunning} onClick={() => handleGenerate('section')} type="button" variant="glass">
              <FileText className="size-4" />
              {generationAction === 'section' ? 'Starting...' : 'Regenerate section'}
            </Button>

            <Button disabled={loading || isPipelineActionRunning || isGenerating} onClick={loadPageState} type="button" variant="glass">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
        )}
        description="Generated technical documentation for repository architecture, API surface and implementation notes."
        eyebrow={`Repo ${Number.isFinite(repoId) ? repoId : 'unknown'}`}
        title="Docs"
      />

      <section aria-label="Documentation status" className="grid gap-3 md:grid-cols-3">
        {statusItems.length > 0 ? statusItems.map(item => (
          <Card className="py-0" key={item.label}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>

                <p className="mt-2 text-lg font-semibold capitalize text-white">{formatStatus(item.value)}</p>
              </div>

              <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${getStatusTone(item.value)}`}>
                {formatStatus(item.value)}
              </span>
            </CardContent>
          </Card>
        )) : (
          <Card className="py-0 md:col-span-3">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
              <Clock3 className="size-4" />
              Status pipeline is not loaded yet.
            </CardContent>
          </Card>
        )}
      </section>

      {docsProgress && (
        <section aria-label="Documentation generation progress" className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                Docs progress{docsProgress.stage ? ` · ${docsProgress.stage}` : ''}
              </p>

              <p className="mt-1 text-white">{docsProgress.message ?? 'Documentation generation is running.'}</p>

              {docsProgress.details && (
                <p className="mt-1 text-xs text-cyan-100/70">{docsProgress.details}</p>
              )}
            </div>

            {docsProgress.counter && (
              <span className="rounded-full border border-cyan-200/25 bg-cyan-200/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                {docsProgress.counter}
              </span>
            )}
          </div>
        </section>
      )}

      {status?.lastPipelineError && (
        <section aria-label="Pipeline error" className="rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>{status.lastPipelineError}</p>
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Documentation navigation" className="glass-panel h-fit rounded-3xl p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen className="size-4 text-primary" />
            Documentation
          </div>

          <nav aria-label="Documentation modules" className="space-y-4 text-sm">
            <div className="space-y-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Modules</p>

              {modules.map(module => {
                const isActive = module.key === activeModule?.key

                return (
                  <button
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition ${isActive ? 'bg-primary/20 text-white shadow-[0_0_22px_oklch(0.62_0.24_270/0.2)]' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
                    key={module.key}
                    onClick={() => {
                      setSelectedModuleKey(module.key)
                      setSelectedSectionKey(module.sections[0]?.key ?? null)
                    }}
                    title={describeDocsNode(module)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <BookOpen className="size-4 shrink-0" />
                      <span className="truncate">{module.title}</span>
                    </span>

                    <span className={`h-2 w-2 shrink-0 rounded-full ${module.status === RepoDocsStatus.READY ? 'bg-emerald-300' : module.status === RepoDocsStatus.FAILED ? 'bg-red-300' : module.status === RepoDocsStatus.PROCESSING ? 'bg-cyan-300' : 'bg-slate-500'}`} />
                  </button>
                )
              })}
            </div>

            {activeModule && (
              <div className="space-y-2 border-t border-white/10 pt-4">
                <p className="px-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sections</p>

                {activeSections.map(section => {
                  const isActive = section.key === activeSection?.key

                  return (
                    <button
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left transition ${isActive ? 'bg-white/10 text-white' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
                      key={`${activeModule.key}:${section.key}`}
                      onClick={() => setSelectedSectionKey(section.key)}
                      title={describeDocsNode(section)}
                      type="button"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <FileText className="size-4 shrink-0" />
                        <span className="truncate">{section.title}</span>
                      </span>

                      <span className={`h-2 w-2 shrink-0 rounded-full ${section.status === RepoDocsStatus.READY ? 'bg-emerald-300' : section.status === RepoDocsStatus.FAILED ? 'bg-red-300' : section.status === RepoDocsStatus.PROCESSING ? 'bg-cyan-300' : 'bg-slate-500'}`} />
                    </button>
                  )
                })}
              </div>
            )}
          </nav>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/3 p-3 text-xs text-muted-foreground">
            {status?.docsStatus === RepoDocsStatus.READY ? (
              <span className="flex items-center gap-2 text-emerald-200">
                <CheckCircle2 className="size-4" />
                Documentation is ready.
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Clock3 className="size-4" />
                Generation depends on cloned repo and embeddings.
              </span>
            )}
          </div>
        </aside>

        <main className="min-w-0" id="documentation-content">
          <Card className="min-h-155 py-0">
            <CardContent className="p-5 md:p-8">
              <div aria-live="polite">
                {loading && <p className="text-sm text-muted-foreground">Loading documentation state...</p>}

                {error && (
                  <p className="flex items-center gap-2 text-sm text-red-300" role="alert">
                    <TriangleAlert className="size-4" />
                    {error}
                  </p>
                )}

                {!loading && !error && status?.docsStatus === RepoDocsStatus.PENDING && (
                  <p className="text-sm text-muted-foreground">
                    Documentation is not generated yet. Start generation when embeddings are ready.
                  </p>
                )}

                {!loading && !error && status?.docsStatus === RepoDocsStatus.PROCESSING && (
                  <p className="text-sm text-muted-foreground">
                    Documentation generation is in progress. This view refreshes automatically every {DOCS_STATUS_POLL_MS / 1000}s.
                  </p>
                )}

                {!loading && !error && status?.docsStatus === RepoDocsStatus.FAILED && (
                  <p className="flex items-center gap-2 text-sm text-red-300" role="alert">
                    <TriangleAlert className="size-4" />
                    Documentation generation failed. Retry after confirming embeddings are ready.
                  </p>
                )}
              </div>

              {activeModule && activeSection && (
                <div className="mt-6 rounded-2xl border border-white/10 bg-white/3 px-4 py-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 capitalize ${getStatusTone(activeSection.status)}`}>
                      {formatStatus(activeSection.status)}
                    </span>

                    <span>{activeModule.title} / {activeSection.title}</span>

                    {formatDateTime(activeSection.generatedAt) && (
                      <span>Generated {formatDateTime(activeSection.generatedAt)}</span>
                    )}
                  </div>

                  {activeSection.error && (
                    <p className="mt-2 text-red-300">{activeSection.error}</p>
                  )}
                </div>
              )}

              {activeMarkdown ? (
                <article className="prose prose-sm mt-6 max-w-none prose-headings:tracking-[-0.04em] prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950/80 prose-pre:text-gray-100 dark:prose-invert md:prose-base">
                  <h1 className="sr-only">{activeSection?.title}</h1>

                  <Markdown
                    components={{
                      blockquote: ({ children }) => (
                        <blockquote className="my-4 border-l-4 border-primary bg-primary/10 py-2 pl-4 italic">
                          {children}
                        </blockquote>
                      ),
                      code: ({ children, className, ...props }) => {
                        const match = /language-(\w+)/.exec(className || '')

                        return match ? (
                          <div className="relative">
                            <div className="absolute right-2 top-2 rounded bg-slate-950/90 px-2 py-1 text-xs text-cyan-200">
                              {match[1]}
                            </div>

                            <code className={className} {...props}>
                              {children}
                            </code>
                          </div>
                        ) : (
                          <code
                            className="rounded border border-white/10 bg-white/10 px-1 py-0.5 text-sm text-cyan-100"
                            {...props}
                          >
                            {children}
                          </code>
                        )
                      },
                      table: ({ children }) => (
                        <div className="overflow-x-auto rounded-xl border border-white/10">
                          <table className="min-w-full border-collapse">
                            {children}
                          </table>
                        </div>
                      ),
                      td: ({ children }) => (
                        <td className="border border-white/10 px-4 py-2">{children}</td>
                      ),
                      th: ({ children }) => (
                        <th className="border border-white/10 bg-white/10 px-4 py-2 text-left font-semibold">
                          {children}
                        </th>
                      )
                    }}
                    rehypePlugins={[rehypeHighlight]}
                    remarkPlugins={[remarkGfm]}
                  >
                    {activeMarkdown}
                  </Markdown>
                </article>
              ) : !loading && !error && (
                <div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-white/3 p-10 text-center">
                  <FileText className="mx-auto size-10 text-muted-foreground" />

                  <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-white">
                    {activeModule && activeSection ? `${activeModule.title} / ${activeSection.title} is not generated yet` : 'No generated document yet'}
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Generate docs after repository cloning and embedding stages are complete.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
