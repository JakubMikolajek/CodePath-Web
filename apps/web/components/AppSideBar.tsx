'use client'

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
  SidebarRail,
} from '@workspace/ui/components/sidebar'
import { Spinner } from '@workspace/ui/components/spinnder'
import {
  FolderGit2,
} from 'lucide-react'
import React, { ComponentProps, useEffect } from 'react'


import CreateRepoDialog from '@/components/repo/CreateRepoDialog'
import RepoItem from '@/components/repo/RepoItem'
import UserDropdownMenu from '@/components/UserDropdownMenu'
import { useReposStore } from '@/store'

export default function AppSidebar({ ...props }: ComponentProps<typeof Sidebar>) {
  const { repos, getRepos, loading } = useReposStore()

  useEffect(() => {
    getRepos()
  }, [])

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
        {loading ? <div className="flex items-center gap-2 px-4 justify-center h-full">
          <div className="text-left text-sm leading-tight">
            <Spinner>Loading...</Spinner>
          </div>
        </div> : <>
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
              {repos.map((item) => <RepoItem key={item.id} item={item} />)}
            </SidebarMenu>
          </SidebarGroup>
        </>}
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
