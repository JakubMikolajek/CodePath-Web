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
import { BotMessageSquare, Braces, ChevronRight, FileText, GitBranch, GitFork, Plus, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  const chatSessions = useAppSelector(state => state.chat.chatSessions)
  const graphs = useAppSelector(state => state.graphs.graphs)
  const openRepoId = useAppSelector(state => state.collapsible.openRepoId)

  const isRepoOpen = openRepoId === item.id
  const hasPipelineFailure = item.cloneStatus === 'failed'
    || item.embeddingStatus === 'failed'
    || item.docsStatus === 'failed'
  const hasPipelineInProgress = item.cloneStatus === 'pending'
    || item.cloneStatus === 'cloning'
    || item.embeddingStatus === 'pending'
    || item.embeddingStatus === 'processing'
    || item.docsStatus === 'processing'

  const handleOpenChange = (open: boolean) => {
    void dispatch(setOpenRepoId(open ? item.id : null))

    if (open) {
      void dispatch(getChatSessions(item.id))
      void dispatch(getGraphs(item.id))
    }
  }

  return (
    <Collapsible asChild className="group/collapsible-main" key={item.id} onOpenChange={handleOpenChange} open={isRepoOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className="h-11" tooltip={item.name}>
            <GitBranch className="size-4" />
            <span>{item.name}</span>
            {(hasPipelineFailure || hasPipelineInProgress) && (
              <TriangleAlert className={hasPipelineFailure ? 'ml-auto size-4 text-red-300' : 'ml-auto size-4 text-amber-300'} />
            )}
            <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible-main:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="ml-4 mt-2 gap-1 border-l border-sidebar-border/70 pl-3">
            <Collapsible asChild className="group/collapsible-chat">
              <SidebarMenuSubItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuSubButton className="rounded-lg">
                    <BotMessageSquare className="size-4" />
                    <span>AI Chat</span>
                    <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible-chat:rotate-90" />
                  </SidebarMenuSubButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="gap-1">
                    <SidebarMenuButton asChild className="h-9" onClick={() => {
                      void dispatch(createSession(item.id))
                    }}>
                      <button type="button">
                        <Plus className="size-4" />
                        <span>New chat</span>
                      </button>
                    </SidebarMenuButton>
                    {chatSessions.map(session => {
                      const href = `/${item.id}/chat/${session.sessionId}`
                      return (
                        <SidebarMenuSubItem key={session.sessionId}>
                          <SidebarMenuSubButton asChild className="rounded-lg" isActive={pathname === href}>
                            <Link href={href}><span>{session.sessionName}</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuSubItem>
            </Collapsible>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild className="rounded-lg" isActive={pathname === `/${item.id}/api`}>
                <Link href={`/${item.id}/api`}><Braces className="size-4" /><span>API Explorer</span></Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton asChild className="rounded-lg" isActive={pathname === `/${item.id}/docs`}>
                <Link href={`/${item.id}/docs`}><FileText className="size-4" /><span>Docs</span></Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <Collapsible asChild className="group/collapsible-graphs">
              <SidebarMenuSubItem>
                <CollapsibleTrigger asChild>
                  <SidebarMenuSubButton className="rounded-lg">
                    <GitFork className="size-4" />
                    <span>Graphs</span>
                    <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible-graphs:rotate-90" />
                  </SidebarMenuSubButton>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub className="gap-1">
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild className="rounded-lg" isActive={pathname === `/${item.id}/graphs`}>
                        <Link href={`/${item.id}/graphs`}><span>Interactive graph</span></Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    {graphs.map(graph => {
                      const href = `/${item.id}/graphs/${graph.id}`
                      return (
                        <SidebarMenuSubItem key={graph.id}>
                          <SidebarMenuSubButton asChild className="rounded-lg" isActive={pathname === href}>
                            <Link href={href}><span>Legacy: {graph.fileName}</span></Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      )
                    })}
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
