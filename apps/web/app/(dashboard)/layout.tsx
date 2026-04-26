'use server'

import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import { cookies } from 'next/headers'
import type { ReactNode } from 'react'

import AppSidebar from '@/components/AppSideBar'
import { getCurrentUser } from '@/lib/auth/server'
import { getRepos } from '@/lib/repos/server'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({ children }: Readonly<DashboardLayoutProps>) {
  const cookieStore = await cookies()
  const cookie = cookieStore.toString()

  const me = await getCurrentUser(cookie)
  const repos = await getRepos(cookie)

  return (
    <SidebarProvider defaultOpen>
      <div className="aurora-shell app-aurora-shell flex min-h-svh w-full">
        <AppSidebar fetchedRepos={repos} me={me} />
        <SidebarInset className="min-w-0 bg-transparent">
          <main className="min-h-svh w-full px-4 py-4 md:px-6 lg:px-8">
            <div className="mx-auto min-h-[calc(100svh-2rem)] w-full max-w-[100rem] rounded-[2rem] border border-border/45 bg-background/48 p-5 shadow-[inset_0_1px_0_oklch(1_0_0/0.06),0_28px_90px_rgb(0_0_0/0.3)] backdrop-blur-2xl md:p-8">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
