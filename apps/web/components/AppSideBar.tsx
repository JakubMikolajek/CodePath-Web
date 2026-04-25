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
  LayoutDashboard,
  X
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect } from 'react'

import { BrandMark } from '@/components/BrandMark'
import CreateRepoDialog from '@/components/repo/CreateRepoDialog'
import RepoItem from '@/components/repo/RepoItem'
import UserDropdownMenu from '@/components/UserDropdownMenu'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { setMe } from '@/redux/slices/authSlice'
import { dismissSyncError, getRepos, setRepos } from '@/redux/slices/reposSlice'

interface AppSideBarProps {
  fetchedRepos: Repository[]
  me: IUser
}

const REPOS_REFRESH_INTERVAL_MS = 7_500

export default function AppSidebar({ fetchedRepos, me }: AppSideBarProps) {
  const dispatch = useAppDispatch()
  const pathname = usePathname()
  const repos = useAppSelector(state => state.repos.repos)
  const syncError = useAppSelector(state => state.repos.syncError)
  const syncErrorNonce = useAppSelector(state => state.repos.syncErrorNonce)
  const [showSyncErrorToast, setShowSyncErrorToast] = React.useState(false)

  useEffect(() => {
    dispatch(setMe(me))
    dispatch(setRepos(fetchedRepos))
  }, [dispatch, fetchedRepos, me])

  useEffect(() => {
    void dispatch(getRepos())

    const interval = setInterval(() => {
      void dispatch(getRepos())
    }, REPOS_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [dispatch])

  useEffect(() => {
    if (!syncError) {
      setShowSyncErrorToast(false)
      return
    }

    setShowSyncErrorToast(true)
    const timeout = setTimeout(() => {
      setShowSyncErrorToast(false)
    }, 6000)

    return () => clearTimeout(timeout)
  }, [syncError, syncErrorNonce])

  return (
    <>
      <Sidebar className="border-r border-sidebar-border/80 bg-sidebar/90" collapsible="icon" variant="sidebar">
        <SidebarHeader className="px-5 py-7">
          <BrandMark />
        </SidebarHeader>
        <SidebarContent className="px-4 pb-4">
          <SidebarGroup className="gap-2 p-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="h-12" isActive={pathname === '/dashboard'} size="lg" tooltip="Dashboard">
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-5" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-6 p-0">
            <SidebarGroupLabel className="px-3 text-[0.68rem] uppercase tracking-[0.22em] text-muted-foreground/85">
              Repositories
            </SidebarGroupLabel>
            <SidebarMenu className="mt-2 gap-2">
              <CreateRepoDialog>
                <SidebarMenuButton className="h-11" tooltip="Add repository">
                  <FolderGit2 className="size-4" />
                  <span>Add repo</span>
                </SidebarMenuButton>
              </CreateRepoDialog>
              {repos.map(item => <RepoItem item={item} key={item.id} />)}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/70 p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <UserDropdownMenu />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      {showSyncErrorToast && syncError && (
        <div
          aria-live="polite"
          className="glass-panel fixed bottom-4 right-4 z-50 w-[22rem] rounded-2xl border-destructive/50 p-4 shadow-2xl"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-100">Repository sync failed</p>
              <p className="mt-1 text-xs text-red-100/80">{syncError}</p>
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-lg border border-red-300/30 px-3 py-1.5 text-xs text-red-100 hover:bg-red-400/10"
                  onClick={() => {
                    void dispatch(getRepos())
                  }}
                  type="button"
                >
                  Retry now
                </button>
                <button
                  className="rounded-lg border border-red-300/30 px-3 py-1.5 text-xs text-red-100 hover:bg-red-400/10"
                  onClick={() => {
                    void dispatch(dismissSyncError())
                  }}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              aria-label="Close sync error notification"
              className="rounded-lg p-1 text-red-100 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                void dispatch(dismissSyncError())
              }}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
