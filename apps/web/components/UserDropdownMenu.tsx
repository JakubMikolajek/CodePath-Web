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

  const handleLogout = async () => await dispatch(logout())

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton className="glass-panel h-16 rounded-2xl px-4 data-[state=open]:border-primary/60 data-[state=open]:text-white" size="lg">
          <div className="grid size-10 place-items-center rounded-full bg-[linear-gradient(135deg,oklch(0.64_0.24_258),oklch(0.62_0.25_288))] text-sm font-bold text-white shadow-[0_0_24px_oklch(0.62_0.24_270/0.36)]">
            {(user?.login ?? 'JM').slice(0, 2).toUpperCase()}
          </div>

          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-semibold text-white">{user?.login ?? 'User'}</span>

            <span className="truncate text-xs text-muted-foreground">Administrator</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="glass-panel min-w-56 rounded-2xl p-2" side="bottom" sideOffset={8}>
        <DropdownMenuItem className="gap-2 rounded-xl p-2" onClick={() => setTheme('light')}>
          <Sun className="h-4 w-4" />
          Light theme
        </DropdownMenuItem>

        <DropdownMenuItem className="gap-2 rounded-xl p-2" onClick={() => setTheme('dark')}>
          <Moon className="h-4 w-4" />
          Dark theme
        </DropdownMenuItem>

        <DropdownMenuItem className="mt-2 gap-2 rounded-xl border-t border-border/70 p-2 pt-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
