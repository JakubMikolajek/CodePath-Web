'use client'
import 'highlight.js/styles/github-dark-dimmed.css'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Bot, Check, Copy, Send, Sparkles, User } from 'lucide-react'
import { useParams } from 'next/navigation'
import type React from 'react'
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
  const [copiedId, setCopiedId] = useState<null | string>(null)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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
    if (!hasValidRouteParams) {
      return
    }

    void dispatch(getSessionDetails({
      repoId,
      sessionId
    }))
  }, [dispatch, hasValidRouteParams, repoId, sessionId])

  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col gap-6">
      <PageHeader
        description="Repository-aware assistant for DTOs, endpoints, documentation and code navigation context."
        eyebrow={`Repo ${Number.isFinite(repoId) ? repoId : 'unknown'}`}
        title="AI Chat"
      />

      <section
        aria-label="Chat conversation"
        className="glass-panel-strong flex min-h-[620px] flex-1 flex-col overflow-hidden rounded-[2rem]"
      >
        <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
          {sessionDetails.length === 0 && !isLoading && (
            <Card className="mx-auto mt-12 max-w-2xl border-primary/20 bg-primary/5 py-0">
              <CardContent className="p-8 text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary/15 text-primary shadow-[0_0_28px_oklch(0.62_0.24_270/0.3)]">
                  <Sparkles className="size-6" />
                </div>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">Ask about this repository</h2>
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
                  <Card className="max-w-[min(760px,88%)] border-cyan-300/25 bg-cyan-400/10 py-0 shadow-[0_0_32px_oklch(0.74_0.17_220/0.12)]">
                    <CardContent className="p-4 md:p-5">
                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-cyan-100">
                        <span className="grid size-8 place-items-center rounded-full bg-cyan-300/15 text-cyan-200">
                          <User className="size-4" />
                        </span>
                        Ty
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90 md:text-base">{detail.content}</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex justify-start">
                  <Card className="max-w-[min(920px,94%)] border-primary/35 bg-primary/10 py-0 shadow-[0_0_38px_oklch(0.62_0.24_270/0.16)]">
                    <CardContent className="p-4 md:p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-primary-foreground">
                          <span className="grid size-8 place-items-center rounded-full bg-primary/20 text-primary">
                            <Bot className="size-4" />
                          </span>
                          Asystent AI
                        </div>
                        <Button
                          aria-label="Skopiuj odpowiedź"
                          className="size-9"
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
                      <article className="prose prose-sm max-w-none prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950/80 prose-pre:text-gray-100 dark:prose-invert">
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
              <Card className="max-w-[min(680px,92%)] border-primary/30 bg-primary/10 py-0">
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

        <div className="border-t border-white/10 bg-slate-950/55 p-4 backdrop-blur-xl">
          <form className="glass-panel flex items-end gap-3 rounded-2xl p-2" onSubmit={handleSubmit}>
            <div className="flex-1">
              <Input
                aria-label="Treść wiadomości"
                className="min-h-12 border-transparent bg-transparent shadow-none"
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
              className="size-12"
              disabled={isLoading || !inputValue.trim() || !hasValidRouteParams}
              size="icon"
              type="submit"
              variant="glow"
            >
              <Send className="size-5" />
            </Button>
          </form>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {hasValidRouteParams
              ? 'Enter wysyła wiadomość, Shift+Enter dodaje nową linię.'
              : 'Nieprawidłowe parametry sesji czatu.'}
          </p>
        </div>
      </section>
    </div>
  )
}
