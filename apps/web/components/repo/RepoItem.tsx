'use client'

import type { Repository } from '@workspace/codepath-common/repository'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@workspace/ui/components/collapsible'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@workspace/ui/components/sidebar'
import { ChevronRight, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { createSession, getChatSessions } from '@/redux/slices/chatSlice'
import { setOpenRepoId } from '@/redux/slices/collapsibleSlice'
import { getGraphs } from '@/redux/slices/graphsSlice'

interface RepoItemProps {
  item: Repository
}

export default function RepoItem({ item }: RepoItemProps) {
  const dispatch = useAppDispatch()
  const chatSessions = useAppSelector(state => state.chat.chatSessions)
  const graphs = useAppSelector(state => state.graphs.graphs)
  const openRepoId = useAppSelector(state => state.collapsible.openRepoId)

  const isRepoOpen = openRepoId === item.id

  const handleOpenChange = (open: boolean) => {
    dispatch(setOpenRepoId(open ? item.id : null))

    if (open) {
      dispatch(getChatSessions(item.id))
      dispatch(getGraphs(item.id))
    }
  }

  return (
    <Collapsible
      asChild
      className="group/collapsible-main"
      key={item.id}
      onOpenChange={handleOpenChange}
      open={isRepoOpen}
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.name}>
            <div className="flex flex-row gap-1 items-center">
              <span>{item.name}</span>
              {item.embeddingStatus === 'pending' && (
                <TriangleAlert color="orange" />
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
                    <SidebarMenuButton asChild onClick={() => dispatch(createSession(item.id))}>
                      <span>New chat</span>
                      {/*<LucideMessagesSquare className="ml-auto h-4 w-4" />*/}
                    </SidebarMenuButton>
                    {chatSessions.map(session => (
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
            <Collapsible asChild className="group/collapsible-graphs">
              <SidebarMenuSubItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuSubButton>
                    <span>Graphs</span>
                    <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/graphs:rotate-90" />
                  </SidebarMenuSubButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {graphs.map(graph => (
                      <SidebarMenuSubItem key={graph.id}>
                        <SidebarMenuSubButton asChild>
                          <Link href={`/${item.id}/graphs/${graph.id}`}>
                            <span>{graph.fileName}</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuSubItem>
            </Collapsible>
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
