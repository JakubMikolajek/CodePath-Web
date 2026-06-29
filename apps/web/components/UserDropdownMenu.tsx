'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@workspace/ui/components/dropdown-menu'
import { SidebarMenuButton } from '@workspace/ui/components/sidebar'
import { LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import React from 'react'

import { Accent, ACCENT_PRESETS, useAccentTheme } from '@/hooks/useAccentTheme'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { logout } from '@/redux/slices/authSlice'

export default function UserDropdownMenu() {
  const { theme, setTheme } = useTheme()
  const { accent, setAccent } = useAccentTheme()
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.auth.user)

  const isDark = theme !== 'light'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="h-[46px] rounded-[10px] px-[9px] hover:bg-white/[0.03] data-[state=open]:bg-white/[0.04]"
          size="lg"
        >
          <div className="grid size-8 place-items-center rounded-[9px] bg-[linear-gradient(135deg,var(--nurt-accent),var(--nurt-accent2))] font-mono text-xs font-semibold text-[var(--nurt-ink)]">
            {(user?.login ?? 'JM').slice(0, 2).toUpperCase()}
          </div>
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate text-[12.5px] font-medium text-foreground">
              {user?.login ?? 'User'}
            </span>
            <span className="truncate text-[11px] text-[var(--nurt-t3)]">Administrator</span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="min-w-56 rounded-[13px] border border-[var(--nurt-line2)] bg-[var(--nurt-bg2)] p-2 shadow-[0_28px_70px_-22px_rgba(0,0,0,0.85)]"
        side="bottom"
        sideOffset={8}
      >
        {/* BASE THEME label */}
        <div className="px-[9px] pb-[6px] pt-[6px]">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--nurt-t3)]">
            Base theme
          </span>
        </div>

        {/* Light / Dark segmented control */}
        <div className="mx-[9px] mb-[8px] flex rounded-[9px] bg-[var(--nurt-bg1)] p-[3px]">
          <button
            className={`flex flex-1 items-center justify-center gap-[5px] rounded-[7px] py-[5px] text-[11px] font-medium transition-all ${
              !isDark
                ? 'bg-[var(--nurt-bg3)] text-[var(--nurt-t1)] shadow-sm'
                : 'text-[var(--nurt-t3)] hover:text-[var(--nurt-t2)]'
            }`}
            onClick={() => setTheme('light')}
            type="button"
          >
            <Sun className="h-3 w-3" />
            Light
          </button>
          <button
            className={`flex flex-1 items-center justify-center gap-[5px] rounded-[7px] py-[5px] text-[11px] font-medium transition-all ${
              isDark
                ? 'bg-[var(--nurt-bg3)] text-[var(--nurt-t1)] shadow-sm'
                : 'text-[var(--nurt-t3)] hover:text-[var(--nurt-t2)]'
            }`}
            onClick={() => setTheme('dark')}
            type="button"
          >
            <Moon className="h-3 w-3" />
            Dark
          </button>
        </div>

        {/* Accent swatches */}
        <div className="flex gap-2 px-[9px] pb-[10px]">
          {ACCENT_PRESETS.map(p => (
            <button
              key={p.key}
              className="h-[30px] flex-1 cursor-pointer rounded-[8px] transition-transform hover:-translate-y-px"
              onClick={() => setAccent(p.key)}
              style={{
                background: p.swatch,
                boxShadow:
                  accent === p.key
                    ? `0 0 0 2px ${p.ring}, 0 0 0 4px rgba(255,255,255,0.06)`
                    : undefined,
              }}
              title={p.label}
              type="button"
            />
          ))}
        </div>

        <div className="mx-[6px] mb-[5px] h-px bg-[var(--nurt-line)]" />

        <DropdownMenuItem
          className="gap-[10px] rounded-[9px] p-[10px] opacity-55"
          disabled
        >
          <Settings className="h-[15px] w-[15px] flex-none text-[var(--nurt-t2)]" />
          <span className="flex-1 text-[12.5px] text-[var(--nurt-t2)]">Settings</span>
          <span className="rounded-[5px] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em] text-[var(--nurt-t3)]">
            SOON
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="gap-[10px] rounded-[9px] p-[10px] text-[#ec8a80] focus:bg-[color-mix(in_oklab,#ec6a5e_14%,transparent)] focus:text-[#ec8a80]"
          onClick={async () => {
            await dispatch(logout())
          }}
        >
          <LogOut className="h-[15px] w-[15px] flex-none" />
          <span className="flex-1 text-[12.5px] font-medium">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
