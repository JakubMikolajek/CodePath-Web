'use client'

import 'highlight.js/styles/github-dark-dimmed.css'
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Send } from 'lucide-react'
import { useParams } from 'next/navigation'
import type React from 'react'
import { useState } from 'react'
import Markdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'

import { useChatStore } from '@/store'

export default function ChatPage() {
  const params = useParams()
  const { sendMessage } = useChatStore()

  const [inputValue, setInputValue] = useState('')
  const [res, setRes] = useState<string>('')

  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!inputValue.trim()) return

    const response = await sendMessage(parseFloat(params.repoId as string), inputValue)
    setRes(response.response)
  }

  return (
    <div className="w-full relative">
      <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
        <div className="flex-1 overflow-y-auto space-y-4 mb-4">
          <article className="prose prose-invert max-w-none">
            <Markdown rehypePlugins={[rehypeHighlight]}>
              {res}
            </Markdown>
          </article>
          {/*{messages.map((message) => (*/}
          {/*  <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>*/}
          {/*    <Card className={`max-w-[70%] ${message.isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>*/}
          {/*      <CardContent className="p-3">*/}
          {/*        <p className="text-sm">{message.content}</p>*/}
          {/*        <p className={'text-xs mt-1 opacity-70'}>*/}
          {/*          {message.timestamp.toLocaleTimeString('pl-PL', {*/}
          {/*            hour: '2-digit',*/}
          {/*            minute: '2-digit',*/}
          {/*          })}*/}
          {/*        </p>*/}
          {/*      </CardContent>*/}
          {/*    </Card>*/}
          {/*  </div>*/}
          {/*))}*/}

          {isLoading && (
            <div className="flex justify-start">
              <Card className="bg-muted">
                <CardContent className="p-3">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0.1s' }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0.2s' }}
                      ></div>
                    </div>
                    <span className="text-sm text-muted-foreground">Serwer pisze...</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Wpisz swoją wiadomość..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
            <Send className="w-4 h-4" />
            <span className="sr-only">Wyślij wiadomość</span>
          </Button>
        </form>
      </div>
    </div>
  )
}
