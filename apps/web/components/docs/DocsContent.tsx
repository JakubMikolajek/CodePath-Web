import type { Nullable, Undefinable } from '@workspace/codepath-common'
import type { RepoDocsModule, RepoDocsSection } from '@workspace/codepath-common/repository'
import { RepoDocsStatus } from '@workspace/codepath-common/repository'
import { Card, CardContent } from '@workspace/ui/components/card'
import { FileText, TriangleAlert } from 'lucide-react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import { DOCS_STATUS_POLL_MS, formatDateTime, formatStatus, getStatusTone } from './docsUtils'

interface DocsContentProps {
  activeModule: Nullable<RepoDocsModule>
  activeSection: Nullable<RepoDocsSection>
  error: Nullable<string>
  isLoading: boolean;
  status: Undefinable<RepoDocsStatus>
}

export function DocsContent({ activeModule, activeSection, error, isLoading, status }: DocsContentProps) {
  const markdown = activeSection?.markdown?.trim() ?? ''

  return (
    <main className="min-w-0 flex-1" id="documentation-content">
      <Card className="min-h-full overflow-hidden rounded-[14px] border-white/6 bg-white/[0.012] py-0">
        <CardContent className="p-0">
          <div aria-live="polite">
            {isLoading && <p className="border-b border-white/6 px-4.5 py-3.5 text-[12.5px] text-muted-foreground">Loading documentation state...</p>}

            {error && <p className="flex items-center gap-2 text-sm text-red-300" role="alert"><TriangleAlert className="size-4" />{error}</p>}

            {!isLoading && !error && status === RepoDocsStatus.PENDING && <p className="border-b border-white/6 px-4.5 py-3.5 text-[12.5px] text-muted-foreground">Documentation is not generated yet. Start generation when embeddings are ready.</p>}

            {!isLoading && !error && status === RepoDocsStatus.PROCESSING && <p className="border-b border-white/6 px-4.5 py-3.5 text-[12.5px] text-muted-foreground">Documentation generation is in progress. This view refreshes automatically every {DOCS_STATUS_POLL_MS / 1000}s.</p>}

            {!isLoading && !error && status === RepoDocsStatus.FAILED && <p className="flex items-center gap-2 text-sm text-red-300" role="alert"><TriangleAlert className="size-4" />Documentation generation failed. Retry after confirming embeddings are ready.</p>}
          </div>

          {activeModule && activeSection && (
            <div className="border-b border-white/6 px-4.5 py-3.5 text-xs text-(--nurt-t3)">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 capitalize ${getStatusTone(activeSection.status)}`}>{formatStatus(activeSection.status)}</span>

                <span>{activeModule.title} / {activeSection.title}</span>

                {formatDateTime(activeSection.generatedAt) && <span>Generated {formatDateTime(activeSection.generatedAt)}</span>}
              </div>

              {activeSection.error && <p className="mt-2 text-red-300">{activeSection.error}</p>}
            </div>
          )}

          {markdown ? (
            <article className="prose prose-sm max-w-none px-4.5 py-5 prose-headings:font-mono prose-headings:tracking-normal prose-pre:border prose-pre:border-white/10 prose-pre:bg-[var(--nurt-bg0)] prose-pre:text-gray-100 dark:prose-invert">
              <h1 className="sr-only">{activeSection?.title}</h1>

              <Markdown
                components={{
                  blockquote: ({ children }) => <blockquote className="my-4 border-l-4 border-primary bg-primary/10 py-2 pl-4 italic">{children}</blockquote>,
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
                      <code className="rounded border border-white/10 bg-white/10 px-1 py-0.5 text-sm text-cyan-100" {...props}>
                        {children}
                      </code>
                    )
                  },
                  table: ({ children }) => <div className="overflow-x-auto rounded-xl border border-white/10"><table className="min-w-full border-collapse">{children}</table></div>,
                  td: ({ children }) => <td className="border border-white/10 px-4 py-2">{children}</td>,
                  th: ({ children }) => <th className="border border-white/10 bg-white/10 px-4 py-2 text-left font-semibold">{children}</th>
                }}
                rehypePlugins={[rehypeHighlight]}
                remarkPlugins={[remarkGfm]}
              >
                {markdown}
              </Markdown>
            </article>
          ) : !isLoading && !error && (
            <div className="flex min-h-90 flex-col items-center justify-center gap-3.5 p-10 text-center">
              <div className="grid size-13.5 place-items-center rounded-[14px] border border-white/10 bg-white/2 text-(--nurt-t3)">
                <FileText className="size-6.5" />
              </div>

              <h2 className="text-base font-semibold tracking-normal text-foreground">
                {activeModule && activeSection ? `${activeModule.title} / ${activeSection.title} is not generated yet` : 'No generated document yet'}
              </h2>

              <p className="mx-auto max-w-85 text-[12.5px] leading-normal text-(--nurt-t3)">
                Generate docs after repository cloning and embedding stages are complete.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
