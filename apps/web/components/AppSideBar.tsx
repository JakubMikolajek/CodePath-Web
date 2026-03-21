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
import React, { useEffect } from 'react'

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
  const repos = useAppSelector(state => state.repos.repos)
  const syncError = useAppSelector(state => state.repos.syncError)
  const syncErrorNonce = useAppSelector(state => state.repos.syncErrorNonce)
  const [showSyncErrorToast, setShowSyncErrorToast] = React.useState(false)

  useEffect(() => {
    dispatch(setMe(me))
    dispatch(setRepos(fetchedRepos))
  }, [dispatch, fetchedRepos, me])

  useEffect(() => {
    dispatch(getRepos())

    const interval = setInterval(() => {
      dispatch(getRepos())
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
      {showSyncErrorToast && syncError && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 w-[22rem] rounded-md border border-red-200 bg-red-50 p-3 shadow-md"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Repository sync failed</p>
              <p className="mt-1 text-xs text-red-700">{syncError}</p>
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                  onClick={() => {
                    dispatch(getRepos())
                  }}
                  type="button"
                >
                  Retry now
                </button>
                <button
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                  onClick={() => {
                    dispatch(dismissSyncError())
                  }}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              aria-label="Close sync error notification"
              className="text-red-700"
              onClick={() => {
                dispatch(dismissSyncError())
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
