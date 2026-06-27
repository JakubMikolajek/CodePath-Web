'use client'
import 'highlight.js/styles/github-dark-dimmed.css'

import type { Nullable } from '@workspace/codepath-common/globals'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Bot, Check, Copy, Send, Sparkles, User } from 'lucide-react'
import { useParams } from 'next/navigation'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import { PageHeader } from '@/components/PageHeader'
import { getFirstRouteParam } from '@/lib/route-params'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { getSessionDetails, sendMessage } from '@/redux/slices/chatSlice'

export default function ChatPage() {
  const params = useParams()
  const dispatch = useAppDispatch()

  const sessionDetails = useAppSelector(state => state.chat.sessionDetails)

  const repoId = useMemo(() => Number(getFirstRouteParam(params.repoId)), [params.repoId])
  const sessionId = useMemo(() => getFirstRouteParam(params.sessionId) ?? '', [params.sessionId])
  const hasValidRouteParams = Number.isFinite(repoId) && sessionId.length > 0

  const [copiedId, setCopiedId] = useState<Nullable<string>>(null)
  const [inputValue, setInputValue] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!inputValue.trim() || !hasValidRouteParams) return

    setIsLoading(true)

    try {
      await dispatch(sendMessage({
        question: inputValue,
        repoId,
        sessionId
      })).unwrap()

      await dispatch(getSessionDetails({
        repoId,
        sessionId
      })).unwrap()

      setInputValue('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  useEffect(() => {
    if (!hasValidRouteParams) return

    void dispatch(getSessionDetails({
      repoId,
      sessionId
    }))
  }, [hasValidRouteParams, repoId, sessionId])

  return (
    <div className="flex h-[calc(100svh-70px)] flex-col gap-[18px]">
      <PageHeader
        description="Repository-aware assistant for DTOs, endpoints, documentation and code navigation context."
        eyebrow={`Repo ${Number.isFinite(repoId) ? repoId : 'unknown'}`}
        title="AI Chat"
      />

      <section
        aria-label="Chat conversation"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(20,27,40,0.4),rgba(13,17,26,0.25))]"
      >
        <div className="flex-1 space-y-[18px] overflow-y-auto p-[22px]">
          {sessionDetails.length === 0 && !isLoading && (
            <Card className="mx-auto mt-12 max-w-2xl rounded-[14px] border-primary/25 bg-primary/10 py-0">
              <CardContent className="p-8 text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-[14px] border border-white/10 bg-white/[0.02] text-primary">
                  <Sparkles className="size-6" />
                </div>

                <h2 className="mt-5 text-base font-semibold tracking-normal text-foreground">Ask about this repository</h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Start with a concrete question, for example about DTO shape, endpoint behaviour or module responsibilities.
                </p>
              </CardContent>
            </Card>
          )}

          {sessionDetails.map(detail => (
            <div className="space-y-4" key={detail.id}>
              {detail.role === 'user' ? (
                <div className="flex justify-end">
                  <Card className="max-w-[520px] overflow-hidden rounded-[14px] border-primary/30 bg-primary/12 py-0">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-2 border-b border-white/[0.06] px-[14px] py-[9px] text-[12.5px] font-semibold text-foreground">
                        <User className="size-[13px] text-primary" />
                        Ty
                      </div>

                      <p className="px-[14px] py-3 text-[13px] leading-relaxed text-foreground">{detail.content}</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex justify-start">
                  <Card className="max-w-[680px] overflow-hidden rounded-[14px] border-secondary/30 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--nurt-accent2)_12%,transparent),color-mix(in_oklab,var(--nurt-accent)_5%,transparent))] py-0">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-[15px] py-[11px]">
                        <div className="flex items-center gap-[9px] text-[13px] font-semibold text-foreground">
                          <span className="grid size-6 place-items-center rounded-[7px] bg-[linear-gradient(135deg,var(--nurt-accent),var(--nurt-accent2))] text-[var(--nurt-ink)]">
                            <Bot className="size-[13px]" />
                          </span>
                          Asystent AI
                        </div>

                        <Button
                          aria-label="Skopiuj odpowiedź"
                          className="size-7 text-[var(--nurt-t3)] hover:text-foreground"
                          onClick={() => copyToClipboard(detail.content, detail.id)}
                          size="icon"
                          variant="ghost"
                        >
                          {copiedId === detail.id ? (
                            <Check className="size-4 text-emerald-300" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                        </Button>
                      </div>

                      <article className="prose prose-sm max-w-none px-4 py-[14px] text-[13px] leading-[1.6] prose-p:my-2 prose-strong:text-foreground prose-code:rounded prose-code:border-0 prose-code:bg-white/[0.06] prose-code:px-1.5 prose-code:py-0.5 prose-code:font-mono prose-code:text-[11.5px] prose-code:text-foreground prose-pre:border prose-pre:border-white/10 prose-pre:bg-[var(--nurt-bg0)] prose-pre:text-gray-100 dark:prose-invert">
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
                          {detail.content}
                        </Markdown>
                      </article>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <Card className="max-w-[680px] rounded-[14px] border-secondary/30 bg-secondary/10 py-0">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                    <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-primary">
                      <Bot className="size-4" />
                    </span>
                    Asystent AI
                  </div>
                  <div className="flex items-center gap-3">
                    <div aria-hidden="true" className="flex gap-1">
                      <span className="size-2 animate-bounce rounded-full bg-primary" />

                      <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />

                      <span className="size-2 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
                    </div>

                    <span className="text-sm text-muted-foreground">Pisze odpowiedź...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.06] p-[14px_16px_16px]">
          <form className="flex items-center gap-[10px] rounded-[13px] border border-white/10 bg-[var(--nurt-bg0)] py-1.5 pl-4 pr-1.5" onSubmit={handleSubmit}>
            <div className="flex-1">
              <Input
                aria-label="Treść wiadomości"
                className="h-[38px] border-transparent bg-transparent px-0 text-[13.5px] shadow-none focus-visible:border-transparent focus-visible:ring-0"
                disabled={isLoading || !hasValidRouteParams}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    await handleSubmit(e)
                  }
                }}
                placeholder="Ask a question..."
                value={inputValue}
              />
            </div>

            <Button
              aria-label="Wyślij wiadomość"
              className="size-[38px] rounded-[10px] border-primary/35 bg-primary/15 text-primary hover:bg-primary/20"
              disabled={isLoading || !inputValue.trim() || !hasValidRouteParams}
              size="icon"
              type="submit"
              variant="glow"
            >
              <Send className="size-5" />
            </Button>
          </form>

          <p className="mt-[10px] text-center font-mono text-[10.5px] text-[var(--nurt-t3)]">
            {hasValidRouteParams
              ? 'Enter wysyła wiadomość, Shift+Enter dodaje nową linię.'
              : 'Nieprawidłowe parametry sesji czatu.'}
          </p>
        </div>
      </section>
    </div>
  )
}
