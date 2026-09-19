'use client'

import { Button } from '@workspace/ui/components/button'
import { ArrowLeft, Printer, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import { assembleExportDocs, demoteMarkdownHeadings } from '@/lib/docs-export'
import { getFirstRouteParam } from '@/lib/route-params'
import { useGetRepoDocsModulesQuery } from '@/redux/api/docsApi'
import { useGetReposQuery } from '@/redux/api/reposApi'

import { formatDateTime, resolveErrorMessage } from './docsUtils'

interface PrintDocsClientProps {
  repoIdParam: string | string[] | undefined
  shouldAutoPrint: boolean
}

export function PrintDocsClient({ repoIdParam, shouldAutoPrint }: PrintDocsClientProps) {
  const repoId = useMemo(() => Number(getFirstRouteParam(repoIdParam)), [repoIdParam])
  const validRepoId = Number.isFinite(repoId)
  const autoPrinted = useRef(false)
  const modulesQuery = useGetRepoDocsModulesQuery(repoId, { skip: !validRepoId })
  const reposQuery = useGetReposQuery(undefined, { skip: !validRepoId })
  const repositoryName = reposQuery.data?.find(repository => repository.id === repoId)?.name ?? `Repository ${repoId}`
  const document = useMemo(() => assembleExportDocs(modulesQuery.data ?? []), [modulesQuery.data])

  useEffect(() => {
    if (!shouldAutoPrint || autoPrinted.current || modulesQuery.isLoading || modulesQuery.isError) return

    autoPrinted.current = true
    window.print()
  }, [modulesQuery.isError, modulesQuery.isLoading, shouldAutoPrint])

  const error = !validRepoId ? 'Invalid repository identifier' : modulesQuery.error ? resolveErrorMessage(modulesQuery.error) : null

  return (
    <div className="print-docs-page mx-auto max-w-5xl">
      {/* This nested dashboard route keeps auth/navigation intact; these scoped rules remove its chrome only from the printed output. */}
      <style>{`
        @media print {
          @page { margin: 16mm; }
          .app-aurora, [data-slot="sidebar"], [data-slot="sidebar-container"], [data-slot="sidebar-gap"] { display: none !important; }
          .app-aurora-shell, [data-slot="sidebar-wrapper"], [data-slot="sidebar-inset"] { background: #fff !important; display: block !important; min-height: 0 !important; }
          [data-slot="sidebar-inset"] > main > div { min-height: 0 !important; padding: 0 !important; }
          .print-docs-toolbar { display: none !important; }
          .print-docs-page { color: #111827 !important; max-width: none !important; }
          .print-docs-page * { color: inherit; }
          .print-module { break-before: page; }
          .print-docs-page h1, .print-docs-page h2, .print-docs-page h3, .print-docs-page pre, .print-docs-page table, .print-docs-page blockquote { break-inside: avoid; }
          .print-docs-page pre { background: #f8fafc !important; border: 1px solid #cbd5e1 !important; color: #0f172a !important; white-space: pre-wrap; }
        }
      `}</style>

      <header className="print-docs-toolbar mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5">
        <Link className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" href={`/${repoId}/docs`}>
          <ArrowLeft className="size-4" />
          Back to docs
        </Link>

        <Button aria-label="Open browser print dialog" onClick={() => window.print()} type="button" variant="glow">
          <Printer className="size-4" />
          Print / Save as PDF
        </Button>
      </header>

      {modulesQuery.isLoading && <p aria-live="polite" className="print-docs-toolbar text-sm text-muted-foreground">Loading generated documentation...</p>}

      {error && (
        <p className="print-docs-toolbar flex items-center gap-2 text-sm text-red-300" role="alert">
          <TriangleAlert className="size-4" />
          {error}
        </p>
      )}

      {!modulesQuery.isLoading && !error && (
        <article className="bg-white px-6 py-10 text-slate-900 sm:px-10 print:p-0">
          <section aria-labelledby="print-document-title" className="min-h-96 border-b border-slate-200 pb-12">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-slate-500">Generated documentation</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight" id="print-document-title">{repositoryName}</h1>
            <p className="mt-6 text-sm text-slate-600">{document.generatedAt ? `Generated ${formatDateTime(document.generatedAt)}` : 'Generated documentation export'}</p>
          </section>

          <nav aria-label="Table of contents" className="border-b border-slate-200 py-10">
            <h2 className="text-2xl font-semibold">Table of contents</h2>
            {document.modules.length ? (
              <ol className="mt-4 list-decimal space-y-2 pl-5">
                {document.modules.map(module => <li key={module.key}><a className="text-slate-700 underline decoration-slate-300 underline-offset-4" href={`#module-${module.key}`}>{module.title}</a></li>)}
              </ol>
            ) : <p className="mt-4 text-slate-600">No documentation modules have been generated yet.</p>}
          </nav>

          {document.modules.map(module => (
            <section aria-labelledby={`module-${module.key}`} className="print-module py-10" id={`module-${module.key}`} key={module.key}>
              <h2 className="text-3xl font-semibold tracking-tight">{module.title}</h2>

              {module.summary && <PrintMarkdown markdown={demoteMarkdownHeadings(module.summary, 2)} />}

              {module.sections.map(section => (
                <section aria-labelledby={`section-${module.key}-${section.key}`} className="mt-10" key={section.key}>
                  <h3 className="text-xl font-semibold" id={`section-${module.key}-${section.key}`}>{section.title}</h3>
                  {/* Stored Markdown remains untouched; headings are demoted so generated headings stay below this document's section heading. */}
                  <PrintMarkdown markdown={demoteMarkdownHeadings(section.markdown ?? '', 3)} />
                </section>
              ))}

              {module.unavailableSections.length > 0 && (
                <section aria-labelledby={`not-generated-${module.key}`} className="mt-10 rounded-md border border-amber-200 bg-amber-50 p-4">
                  <h3 className="text-lg font-semibold" id={`not-generated-${module.key}`}>Not generated</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {module.unavailableSections.map(section => <li key={section.key}>{section.title} ({section.status.replaceAll('_', ' ')})</li>)}
                  </ul>
                </section>
              )}
            </section>
          ))}
        </article>
      )}
    </div>
  )
}

function PrintMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="prose prose-slate mt-5 max-w-none prose-headings:font-semibold prose-pre:rounded-md prose-pre:border prose-pre:border-slate-300 prose-pre:bg-slate-50 prose-pre:text-slate-900 prose-table:border-collapse prose-th:border prose-th:border-slate-300 prose-th:bg-slate-100 prose-th:px-3 prose-th:py-2 prose-td:border prose-td:border-slate-300 prose-td:px-3 prose-td:py-2">
      <Markdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
    </div>
  )
}
