'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@workspace/ui/components/dropdown-menu'
import { SidebarMenuButton } from '@workspace/ui/components/sidebar'
import { LogOut, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import React from 'react'

import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { logout } from '@/redux/slices/authSlice'

export default function UserDropdownMenu() {
  const { setTheme } = useTheme()
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.auth.user)

  const handleLogout = async () => {
    await dispatch(logout())
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          size="lg"
        >
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate text-xs">{user?.login ?? ''}</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
        side="bottom"
        sideOffset={4}
      >
        <DropdownMenuItem className="gap-2 p-2" onClick={() => setTheme('light')}>
          <Sun className="h-4 w-4" />
          Light theme
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2 p-2" onClick={() => setTheme('dark')}>
          <Moon className="h-4 w-4" />
          Dark theme
        </DropdownMenuItem>

        <DropdownMenuItem className="gap-2 p-2 mt-2 border-t pt-2" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
