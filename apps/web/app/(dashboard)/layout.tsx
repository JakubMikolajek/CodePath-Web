'use server'

import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import  { ReactNode } from 'react'

import AppSidebar from '@/components/AppSideBar'

interface DashboardLayoutProps {
  children: ReactNode
}

export default async function DashboardLayout({ children }: Readonly<DashboardLayoutProps>) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 bg-background min-h-screen">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
