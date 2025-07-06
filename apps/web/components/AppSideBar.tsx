'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@workspace/ui/components/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from '@workspace/ui/components/sidebar'
import {
  ChevronRight,
  FolderGit2,
} from 'lucide-react'
import Link from 'next/link'
import React, { ComponentProps, useEffect } from 'react'


import CreateRepoDialog from '@/components/CreateRepoDialog'
import UserDropdownMenu from '@/components/UserDropdownMenu'
import { useReposStore } from '@/store'

export default function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { repos, getRepos, loading } = useReposStore()

  useEffect(() => {
    getRepos()
  }, [])

  useEffect(() => {
    console.log(repos)
  }, [repos])

  return (
    <Sidebar variant="sidebar" {...props}>
      <SidebarHeader className="h-16 border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 justify-center h-full">
          <div className="text-left text-sm leading-tight">
            <span className="truncate font-semibold">CodePath</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <CreateRepoDialog>
            <SidebarMenuButton>
              <span>Add repo</span>
              <FolderGit2 className="ml-auto h-4 w-4" />
            </SidebarMenuButton>
          </CreateRepoDialog>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Repositories</SidebarGroupLabel>
          <SidebarMenu>
            {repos.map((item) => (
              <Collapsible
                key={item.id}
                asChild
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip={item.name}>
                      <span>{item.name}</span>
                      <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild>
                          <Link href={`/${item.id}/chat`}>
                            <span>Chat</span>
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>

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
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="h-16 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <UserDropdownMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
