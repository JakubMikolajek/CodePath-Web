'use client'

import type { Repository } from '@workspace/codepath-common/repository'
import type { IUser } from '@workspace/codepath-common/user'
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
  SidebarRail
} from '@workspace/ui/components/sidebar'
import {
  FolderGit2,
  LayoutDashboard
} from 'lucide-react'
import Link from 'next/link'
import React, { useEffect } from 'react'

import CreateRepoDialog from '@/components/repo/CreateRepoDialog'
import RepoItem from '@/components/repo/RepoItem'
import UserDropdownMenu from '@/components/UserDropdownMenu'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { setMe } from '@/redux/slices/authSlice'
import { setRepos } from '@/redux/slices/reposSlice'

interface AppSideBarProps {
  fetchedRepos: Repository[]
  me: IUser
}

export default function AppSidebar({ fetchedRepos, me }: AppSideBarProps) {
  const dispatch = useAppDispatch()
  const repos = useAppSelector(state => state.repos.repos)

  useEffect(() => {
    dispatch(setMe(me))
    dispatch(setRepos(fetchedRepos))
  }, [])

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader className="h-16 border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-4 justify-center h-full">
          <div className="text-left text-sm leading-tight">
            <span className="truncate font-semibold">CodePath</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenuButton>
            <Link href='/'>Dashboard</Link>
            <LayoutDashboard className='ml-auto h-4 w-4 text-white' />
          </SidebarMenuButton>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Repositories</SidebarGroupLabel>
          <SidebarMenu>
            <CreateRepoDialog>
              <SidebarMenuButton>
                <span>Add repo</span>
                <FolderGit2 className="ml-auto h-4 w-4" />
              </SidebarMenuButton>
            </CreateRepoDialog>
            {repos.map(item => <RepoItem item={item} key={item.id} />)}
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
