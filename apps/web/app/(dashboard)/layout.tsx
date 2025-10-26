'use server'

import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

import AppSidebar from '@/components/AppSideBar'
import { createAxiosServer } from '@/lib/api/axiosServer'
import { getCurrentUser } from '@/lib/auth/server'
import { getRepos } from '@/lib/repos/server'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({ children }: Readonly<DashboardLayoutProps>) {
  const cookieStore = await cookies()
  const cookie = cookieStore.toString()
  createAxiosServer(cookie)

  const me = await getCurrentUser()
  const repos = await getRepos()

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar fetchedRepos={repos} me={me} />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 bg-background min-h-screen">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
