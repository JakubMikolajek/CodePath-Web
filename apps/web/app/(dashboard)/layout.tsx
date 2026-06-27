'use server'

import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import type { ReactNode } from 'react'

import AppSidebar from '@/components/AppSideBar'
import { getCurrentUser } from '@/lib/auth/server'
import { getRepos } from '@/lib/repos/server'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({ children }: Readonly<DashboardLayoutProps>) {
  const me = await getCurrentUser()
  const repos = await getRepos()

  return (
    <SidebarProvider defaultOpen>
      <div className="aurora-shell app-aurora-shell flex min-h-svh w-full">
        <div aria-hidden="true" className="app-aurora">
          <span className="app-aurora-blob app-aurora-blob-1" />
          <span className="app-aurora-blob app-aurora-blob-2" />
          <span className="app-aurora-blob app-aurora-blob-3" />
          <span className="app-aurora-blob app-aurora-blob-4" />
        </div>

        <AppSidebar fetchedRepos={repos} me={me} />

        <SidebarInset className="min-w-0 bg-transparent">
          <main className="min-h-svh w-full">
            <div className="min-h-svh w-full bg-transparent p-[30px_34px_40px]">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
