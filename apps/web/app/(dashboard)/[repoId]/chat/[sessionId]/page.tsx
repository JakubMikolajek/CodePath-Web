'use client'
import 'highlight.js/styles/github-dark-dimmed.css'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Bot, Check, Copy, Send, User } from 'lucide-react'
import { useParams } from 'next/navigation'
import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { getSessionDetails, sendMessage } from '@/redux/slices/chatSlice'

const getRouteParam = (param: string | string[] | undefined) => Array.isArray(param) ? param[0] : param

export default function ChatPage() {
  const params = useParams()
  const dispatch = useAppDispatch()
  const sessionDetails = useAppSelector(state => state.chat.sessionDetails)
  const repoId = useMemo(() => Number(getRouteParam(params.repoId)), [params.repoId])
  const sessionId = useMemo(() => getRouteParam(params.sessionId) ?? '', [params.sessionId])
  const hasValidRouteParams = Number.isFinite(repoId) && sessionId.length > 0
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<null | string>(null)

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

    dispatch(getSessionDetails({
      repoId,
      sessionId
    }))
  }, [dispatch, hasValidRouteParams, repoId, sessionId])

  return (
    <div className="w-full relative bg-background">
      <div className="flex flex-col h-screen max-w-6xl mx-auto">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {sessionDetails.map(detail => (
            <div className="space-y-4" key={detail.id}>
              {detail.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="flex items-start space-x-3 max-w-[70%]">
                    <Card className="bg-muted/50 border-r-4 border-r-blue-500 py-0">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="w-4 h-4" />
                          <span className="text-sm font-medium">Ty</span>
                        </div>
                        <p className="text-sm leading-relaxed">{detail.content}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3 max-w-[85%]">
                    <Card className="bg-muted/50 border-l-4 border-l-blue-500 py-0">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <Bot className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium">Asystent AI</span>
                          </div>
                          <Button
                            className="h-8 w-8 p-0"
                            onClick={() => copyToClipboard(detail.content, detail.id)}
                            size="sm"
                            variant="ghost"
                          >
                            {copiedId === detail.id ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                        <article className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:text-gray-100">
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
                            {detail.content}
                          </Markdown>
                        </article>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-[85%]">
                <Card className="bg-muted/50 border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2 mb-2">
                      <Bot className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Asystent AI</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0.1s' }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                      </div>
                      <span className="text-sm text-muted-foreground">Pisze odpowiedź...</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>

        <div className="border-t bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
          <div className="p-4">
            <form className="flex items-end space-x-2" onSubmit={handleSubmit}>
              <div className="flex-1">
                <Input
                  className="min-h-11 resize-none"
                  disabled={isLoading || !hasValidRouteParams}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      await handleSubmit(e)
                    }
                  }}
                  placeholder="Zadaj pytanie..."
                  value={inputValue}
                />
              </div>
              <Button
                className="h-11 w-11"
                disabled={isLoading || !inputValue.trim() || !hasValidRouteParams}
                size="icon"
                type="submit"
              >
                <Send className="w-4 h-4" />
                <span className="sr-only">Wyślij wiadomość</span>
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              {hasValidRouteParams
                ? 'Naciśnij Enter aby wysłać, Shift+Enter dla nowej linii'
                : 'Nieprawidłowe parametry sesji czatu'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
