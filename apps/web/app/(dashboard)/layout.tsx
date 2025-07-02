'use client'

import { SidebarInset, SidebarProvider } from '@workspace/ui/components/sidebar'
import type React from 'react'

import AppSidebar from '@/components/AppSideBar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset>
        <div className="flex flex-1 flex-col gap-4 p-4 bg-background min-h-screen">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
