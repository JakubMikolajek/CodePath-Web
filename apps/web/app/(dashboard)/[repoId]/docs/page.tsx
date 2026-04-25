'use client'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { BookOpen, CheckCircle2, Clock3, FileText, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import { PageHeader } from '@/components/PageHeader'
import { generateRepoDocs, getRepoDocs, getRepoDocsStatus, type RepoDocsStatusResponse } from '@/lib/docs'
import { getFirstRouteParam } from '@/lib/route-params'

const DOCS_STATUS_POLL_MS = 5_000

const resolveErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const responseData = (error as { response?: { data?: { message?: string | string[] } } }).response?.data?.message

    if (Array.isArray(responseData)) {
      return responseData.join(', ')
    }

    if (typeof responseData === 'string') {
      return responseData
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Unexpected error'
}

const formatStatus = (status: string) => status.replaceAll('_', ' ')

const getStatusTone = (status?: string) => {
  if (status === 'ready' || status === 'embedded' || status === 'cloned') {
    return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
  }

  if (status === 'processing') {
    return 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
  }

  if (status === 'failed') {
    return 'border-red-400/30 bg-red-400/10 text-red-200'
  }

  return 'border-white/10 bg-white/5 text-muted-foreground'
}

export default function Page() {
  const params = useParams()
  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])
  const [error, setError] = useState<null | string>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<null | RepoDocsStatusResponse>(null)
  const [text, setText] = useState('')

  const fetchDocs = useCallback(async () => {
    if (!Number.isFinite(repoId)) {
      return
    }

    const data = await getRepoDocs(repoId)
    setText(typeof data === 'string' ? data : '')
  }, [repoId])

  const fetchStatus = useCallback(async () => {
    if (!Number.isFinite(repoId)) {
      return null
    }

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
      if (nextStatus?.docsStatus === 'ready') {
        await fetchDocs()
      } else {
        setText('')
      }
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setLoading(false)
    }
  }, [fetchDocs, fetchStatus, repoId])

  const handleGenerate = async () => {
    if (!Number.isFinite(repoId)) {
      return
    }

    setIsGenerating(true)
    setError(null)
    try {
      await generateRepoDocs(repoId)
      const nextStatus = await fetchStatus()
      if (nextStatus?.docsStatus !== 'ready') {
        setText('')
      } else {
        await fetchDocs()
      }
    } catch (nextError) {
      setError(resolveErrorMessage(nextError))
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    void loadPageState()
  }, [loadPageState])

  useEffect(() => {
    if (!Number.isFinite(repoId) || status?.docsStatus !== 'processing') {
      return
    }

    const interval = setInterval(() => {
      void (async () => {
        try {
          const nextStatus = await fetchStatus()
          if (nextStatus?.docsStatus === 'ready') {
            await fetchDocs()
          }
        } catch (nextError) {
          setError(resolveErrorMessage(nextError))
        }
      })()
    }, DOCS_STATUS_POLL_MS)

    return () => clearInterval(interval)
  }, [fetchDocs, fetchStatus, repoId, status?.docsStatus])

  const canGenerate = status
    ? status.cloneStatus === 'cloned'
      && status.embeddingStatus === 'embedded'
      && status.docsStatus !== 'processing'
    : false

  const statusItems = status
    ? [
      { label: 'Clone', value: status.cloneStatus },
      { label: 'Embeddings', value: status.embeddingStatus },
      { label: 'Docs', value: status.docsStatus }
    ]
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        actions={(
          <>
            <Button disabled={!canGenerate || isGenerating} onClick={handleGenerate} type="button" variant="glow">
              <Sparkles className="size-4" />
              {isGenerating ? 'Starting...' : 'Generate docs'}
            </Button>
            <Button onClick={loadPageState} type="button" variant="glass">
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </>
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

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Documentation navigation" className="glass-panel h-fit rounded-3xl p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
            <BookOpen className="size-4 text-primary" />
            Documentation
          </div>
          <nav aria-label="Documentation sections" className="space-y-2 text-sm">
            {['Introduction', 'Architecture', 'Core Modules', 'API Surface', 'Deployment', 'Examples'].map((item, index) => (
              <button
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${index === 0 ? 'bg-primary/20 text-white shadow-[0_0_22px_oklch(0.62_0.24_270/0.2)]' : 'text-muted-foreground hover:bg-white/5 hover:text-white'}`}
                key={item}
                type="button"
              >
                <FileText className="size-4" />
                {item}
              </button>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">
            {status?.docsStatus === 'ready' ? (
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
          <Card className="min-h-[620px] py-0">
            <CardContent className="p-5 md:p-8">
              <div aria-live="polite">
                {loading && <p className="text-sm text-muted-foreground">Loading documentation state...</p>}
                {error && (
                  <p className="flex items-center gap-2 text-sm text-red-300" role="alert">
                    <TriangleAlert className="size-4" />
                    {error}
                  </p>
                )}

                {!loading && !error && status?.docsStatus === 'pending' && (
                  <p className="text-sm text-muted-foreground">
                    Documentation is not generated yet. Start generation when embeddings are ready.
                  </p>
                )}

                {!loading && !error && status?.docsStatus === 'processing' && (
                  <p className="text-sm text-muted-foreground">
                    Documentation generation is in progress. This view refreshes automatically every {DOCS_STATUS_POLL_MS / 1000}s.
                  </p>
                )}

                {!loading && !error && status?.docsStatus === 'failed' && (
                  <p className="flex items-center gap-2 text-sm text-red-300" role="alert">
                    <TriangleAlert className="size-4" />
                    Documentation generation failed. Retry after confirming embeddings are ready.
                  </p>
                )}
              </div>

              {text ? (
                <article className="prose prose-sm mt-6 max-w-none prose-headings:tracking-[-0.04em] prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950/80 prose-pre:text-gray-100 dark:prose-invert md:prose-base">
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
                    {text}
                  </Markdown>
                </article>
              ) : !loading && !error && (
                <div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
                  <FileText className="mx-auto size-10 text-muted-foreground" />
                  <h2 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-white">No generated document yet</h2>
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
