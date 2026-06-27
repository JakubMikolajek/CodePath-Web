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
        <SidebarMenuButton className="h-[46px] rounded-[10px] px-[9px] hover:bg-white/[0.03] data-[state=open]:bg-white/[0.04]" size="lg">
          <div className="grid size-8 place-items-center rounded-[9px] bg-[linear-gradient(135deg,var(--nurt-accent),var(--nurt-accent2))] font-mono text-xs font-semibold text-[var(--nurt-ink)]">
            {(user?.login ?? 'JM').slice(0, 2).toUpperCase()}
          </div>

          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate text-[12.5px] font-medium text-foreground">{user?.login ?? 'User'}</span>

            <span className="truncate text-[11px] text-[var(--nurt-t3)]">Administrator</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-56 rounded-[13px] border border-white/10 bg-[var(--nurt-bg2)] p-2" side="bottom" sideOffset={8}>
        <DropdownMenuItem className="gap-2 rounded-[9px] p-2" onClick={() => setTheme('light')}>
          <Sun className="h-4 w-4" />
          Light theme
        </DropdownMenuItem>

        <DropdownMenuItem className="gap-2 rounded-[9px] p-2" onClick={() => setTheme('dark')}>
          <Moon className="h-4 w-4" />
          Dark theme
        </DropdownMenuItem>

        <DropdownMenuItem className="mt-2 gap-2 rounded-[9px] border-t border-white/[0.06] p-2 pt-3" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
