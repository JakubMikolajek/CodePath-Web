'use client'

import { Button } from '@workspace/ui/components/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@workspace/ui/components/collapsible'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@workspace/ui/components/sidebar'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import PopoverWrapper from '@/components/PopoverWrapper'
import type { Repo } from '@/interfaces/repo'
import { useChatStore, useEmbeddingStore, useCollapsibleStore } from '@/store'

interface RepoItemProps {
  item: Repo
}

export default function RepoItem({ item }: RepoItemProps) {
  const [toEmbedding, setToEmbedding] = useState<boolean>(false)
  const { shouldBeEmbedded, runEmbedding } = useEmbeddingStore()
  const { getChatSessions, chatSessions } = useChatStore()
  const { isRepoOpen, setOpenRepoId } = useCollapsibleStore()

  const checkEmbedding = async () => setToEmbedding(await shouldBeEmbedded(item.id))
  const handleEmbedding = async () => await runEmbedding(item.id)
  const handleGetChatSessions = async () => await getChatSessions(item.id)

  const handleOpenChange = (open: boolean) => {
    setOpenRepoId(open ? item.id : null)
  }

  useEffect(() => {
    checkEmbedding()
    handleGetChatSessions()
  }, [])

  return (
    <Collapsible
      key={item.id}
      asChild
      className="group/collapsible-main"
      open={isRepoOpen(item.id)}
      onOpenChange={handleOpenChange}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.name}>
            <div className="flex flex-row gap-1 items-center">
              <span>{item.name}</span>
              {toEmbedding && (
                <PopoverWrapper asChild trigger={<TriangleAlert color="orange" />}>
                  <div className="flex flex-col justify-center items-center gap-2">
                    <p>Embedding required</p>
                    <Button onClick={handleEmbedding} variant="outline">
                      Embed
                    </Button>
                  </div>
                </PopoverWrapper>
              )}
            </div>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible-main:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            <Collapsible asChild className="group/collapsible-chat">
              <SidebarMenuSubItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuSubButton>
                    <span>Chat</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible-chat:rotate-90" />
                  </SidebarMenuSubButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {chatSessions.map((session) => (
                      <SidebarMenuSubItem key={session.sessionId}>
                        <SidebarMenuSubButton asChild>
                          <Link href={`/${item.id}/chat/${session.sessionId}`}>
                            <span>{session.sessionName}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuSubItem>
            </Collapsible>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild>
                <Link href={`/${item.id}/api`}>
                  <span>Api</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild>
                <Link href={`/${item.id}/docs`}>
                  <span>Docs</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
