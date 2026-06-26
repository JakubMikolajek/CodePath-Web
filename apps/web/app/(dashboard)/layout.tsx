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
          <main className="min-h-svh w-full p-2 md:p-3 lg:p-4">
            <div className="min-h-[calc(100svh-1rem)] w-full rounded-4xl border border-border/45 bg-background/48 p-5 shadow-[inset_0_1px_0_oklch(1_0_0/0.06),0_28px_90px_rgb(0_0_0/0.3)] backdrop-blur-2xl md:min-h-[calc(100svh-1.5rem)] md:p-8 lg:min-h-[calc(100svh-2rem)]">
              {children}
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
