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
import { FolderGit2, LayoutDashboard, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

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

  const [showSyncErrorToast, setShowSyncErrorToast] = useState<boolean>(false)

  useEffect(() => {
    dispatch(setMe(me))
    dispatch(setRepos(fetchedRepos))
  }, [fetchedRepos, me])

  useEffect(() => {
    void dispatch(getRepos())

    const interval = setInterval(() => {
      void dispatch(getRepos())
    }, REPOS_REFRESH_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!syncError) {
      setShowSyncErrorToast(false)
      return
    }

    setShowSyncErrorToast(true)

    const timeout = setTimeout(() => setShowSyncErrorToast(false), 6000)

    return () => clearTimeout(timeout)
  }, [syncError, syncErrorNonce])

  return (
    <>
      <Sidebar className="border-r border-white/[0.06] bg-[var(--nurt-bg0)]" collapsible="offcanvas" variant="sidebar">
        <SidebarHeader className="px-[18px] pb-4 pt-[18px]">
          <BrandMark />
        </SidebarHeader>

        <SidebarContent className="px-3 pb-3">
          <SidebarGroup className="gap-2 p-0">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  className="h-[39px] rounded-[9px] px-[11px] text-[13px] font-medium data-[active=true]:border data-[active=true]:border-primary/30 data-[active=true]:bg-primary/15 data-[active=true]:text-primary"
                  isActive={pathname === '/dashboard'}
                  tooltip="Dashboard"
                >
                  <Link href="/dashboard">
                    <LayoutDashboard className="size-4" />

                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup className="mt-[6px] p-0">
            <SidebarGroupLabel className="nurt-label h-auto px-[11px] py-[10px] pb-[7px] text-[var(--nurt-t3)]">
              REPOSITORIES
            </SidebarGroupLabel>

            <SidebarMenu className="gap-0">
              <CreateRepoDialog>
                <SidebarMenuButton className="h-9 rounded-[9px] px-[11px] text-[13px] text-muted-foreground hover:bg-white/[0.03] hover:text-foreground" tooltip="Add repository">
                  <FolderGit2 className="size-4" />

                  <span>Add repo</span>
                </SidebarMenuButton>
              </CreateRepoDialog>

              {repos.map(item => <RepoItem item={item} key={item.id} />)}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/[0.06] p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <UserDropdownMenu />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {showSyncErrorToast && syncError && (
        <div aria-live="polite" className="fixed bottom-4 right-4 z-50 w-88 rounded-[14px] border border-destructive/50 bg-[var(--nurt-bg2)] p-4" role="alert">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-100">Repository sync failed</p>

              <p className="mt-1 text-xs text-red-100/80">{syncError}</p>

              <div className="mt-3 flex gap-2">
                {/* FIXME create button component for that */}
                <button
                  className="rounded-[9px] border border-red-300/30 px-3 py-1.5 text-xs text-red-100 hover:bg-red-400/10"
                  onClick={() => {
                    void dispatch(getRepos())
                  }}
                  type="button"
                >
                  Retry now
                </button>

                {/* FIXME create button component for that */}
                <button
                  className="rounded-[9px] border border-red-300/30 px-3 py-1.5 text-xs text-red-100 hover:bg-red-400/10"
                  onClick={() => {
                    void dispatch(dismissSyncError())
                  }}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* FIXME create button component for that */}
            <button
              aria-label="Close sync error notification"
              className="rounded-[9px] p-1 text-red-100 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
