'use client'

import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

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

export default function Page() {
  const params = useParams()
  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])
  const [text, setText] = useState('')
  const [status, setStatus] = useState<null | RepoDocsStatusResponse>(null)
  const [loading, setLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<null | string>(null)

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

  const statusLabel = status ? `${formatStatus(status.cloneStatus)} / ${formatStatus(status.embeddingStatus)} / ${formatStatus(status.docsStatus)}` : 'unknown'

  return (
    <div className="flex items-center justify-between">
      <div className="w-full">
        <h1 className="text-2xl font-semibold text-foreground">Docs</h1>
        <p className="text-muted-foreground">
          Repo: {Number.isFinite(repoId) ? repoId : String(getFirstRouteParam(params.repoId))}
        </p>
        <p className="text-sm text-muted-foreground mt-1">Pipeline status: {statusLabel}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canGenerate || isGenerating}
            onClick={handleGenerate}
            type="button"
          >
            {isGenerating ? 'Starting...' : 'Generate docs'}
          </button>
          <button
            className="rounded-md border border-border px-3 py-2 text-sm"
            onClick={loadPageState}
            type="button"
          >
            Refresh status
          </button>
        </div>

        {loading && <p className="text-sm text-muted-foreground mt-4">Loading documentation state...</p>}
        {error && <p className="text-sm text-red-500 mt-4">{error}</p>}

        {!loading && !error && status?.docsStatus === 'pending' && (
          <p className="text-sm text-muted-foreground mt-4">
            Documentation is not generated yet. Start generation when embedding is ready.
          </p>
        )}

        {!loading && !error && status?.docsStatus === 'processing' && (
          <p className="text-sm text-muted-foreground mt-4">
            Documentation generation is in progress. This view refreshes automatically every {DOCS_STATUS_POLL_MS / 1000}s.
          </p>
        )}

        {!loading && !error && status?.docsStatus === 'failed' && (
          <p className="text-sm text-red-500 mt-4">
            Documentation generation failed. Retry after confirming embeddings are ready.
          </p>
        )}

        <article className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100 mt-6">
          <Markdown
            components={{
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-blue-500 pl-4 italic bg-blue-50 dark:bg-blue-950/20 py-2 my-4">
                  {children}
                </blockquote>
              ),
              code: ({ children, className, ...props }) => {
                const match = /language-(\w+)/.exec(className || '')
                return match ? (
                  <div className="relative">
                    <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                      {match[1]}
                    </div>
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </div>
                ) : (
                  <code
                    className="bg-gray-200 dark:bg-gray-800 px-1 py-0.5 rounded text-sm"
                    {...props}
                  >
                    {children}
                  </code>
                )
              },
              table: ({ children }) => (
                <div className="overflow-x-auto">
                  <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600">
                    {children}
                  </table>
                </div>
              ),
              td: ({ children }) => (
                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">{children}</td>
              ),
              th: ({ children }) => (
                <th className="border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 px-4 py-2 text-left font-semibold">
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
      </div>
    </div>
  )
}
