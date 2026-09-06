'use client'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@workspace/ui/components/dropdown-menu'
import { SidebarMenuButton } from '@workspace/ui/components/sidebar'
import { LogOut, Moon, Settings, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import React from 'react'

import { ACCENT_PRESETS, useAccentTheme } from '@/hooks/useAccentTheme'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { logout } from '@/redux/slices/authSlice'

export default function UserDropdownMenu() {
  const { setTheme, theme } = useTheme()
  const { accent, setAccent } = useAccentTheme()
  const dispatch = useAppDispatch()
  const user = useAppSelector(state => state.auth.user)

  const isDark = theme !== 'light'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="h-11.5 rounded-xl px-2.25 hover:bg-white/3 data-[state=open]:bg-white/4"
          size="lg"
        >
          <div className="grid size-8 place-items-center rounded-[9px] bg-[linear-gradient(135deg,var(--nurt-accent),var(--nurt-accent2))] font-mono text-xs font-semibold text-(--nurt-ink)">
            {(user?.login ?? 'JM').slice(0, 2).toUpperCase()}
          </div>

          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate text-[12.5px] font-medium text-foreground">
              {user?.login ?? 'User'}
            </span>

            <span className="truncate text-[11px] text-(--nurt-t3)">
              Administrator
            </span>
          </div>
        </SidebarMenuButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="min-w-56 rounded-[13px] border border-(--nurt-line2) bg-(--nurt-bg2) p-2 shadow-[0_28px_70px_-22px_rgba(0,0,0,0.85)]"
        side="bottom"
        sideOffset={8}
      >
        {/* BASE THEME label */}
        <div className="px-2.25 pb-1.5 pt-1.5">
          <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-(--nurt-t3)">
            Base theme
          </span>
        </div>

        {/* Light / Dark segmented control */}
        <div className="mx-2.25 mb-2 flex rounded-[9px] bg-(--nurt-bg1) p-0.75">
          <button
            className={`flex flex-1 items-center justify-center gap-1.25 rounded-[7px] py-1.25 text-[11px] font-medium transition-all ${
              !isDark ? 'bg-(--nurt-bg3) text-(--nurt-t1) shadow-sm' : 'text-(--nurt-t3) hover:text-(--nurt-t2)'
            }`}
            onClick={() => setTheme('light')}
            type="button"
          >
            <Sun className="h-3 w-3" />
            Light
          </button>

          <button
            className={`flex flex-1 items-center justify-center gap-1.25 rounded-[7px] py-1.25 text-[11px] font-medium transition-all ${
              isDark ? 'bg-(--nurt-bg3) text-(--nurt-t1) shadow-sm' : 'text-(--nurt-t3) hover:text-(--nurt-t2)'
            }`}
            onClick={() => setTheme('dark')}
            type="button"
          >
            <Moon className="h-3 w-3" />
            Dark
          </button>
        </div>

        {/* Accent swatches */}
        <div className="flex gap-2 px-2.25 pb-2.5">
          {ACCENT_PRESETS.map(p => (
            <button
              className="h-7.5 flex-1 cursor-pointer rounded-[8px] transition-transform hover:-translate-y-px"
              key={p.key}
              onClick={() => setAccent(p.key)}
              style={{
                background: p.swatch,
                boxShadow: accent === p.key ? `0 0 0 2px ${p.ring}, 0 0 0 4px rgba(255,255,255,0.06)` : undefined
              }}
              title={p.label}
              type="button"
            />
          ))}
        </div>

        <div className="mx-1.5 mb-1.25 h-px bg-(--nurt-line)" />

        <DropdownMenuItem
          className="gap-2.5 rounded-[9px] p-2.5 opacity-55"
          disabled
        >
          <Settings className="h-3.75 w-3.75 flex-none text-(--nurt-t2)" />

          <span className="flex-1 text-[12.5px] text-(--nurt-t2)">
            Settings
          </span>

          <span className="rounded-[5px] bg-white/6 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-(--nurt-t3)">
            SOON
          </span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="gap-2.5 rounded-[9px] p-2.5 text-[#ec8a80] focus:bg-[color-mix(in_oklab,#ec6a5e_14%,transparent)] focus:text-[#ec8a80]"
          onClick={async () => await dispatch(logout())}
        >
          <LogOut className="h-3.75 w-3.75 flex-none" />

          <span className="flex-1 text-[12.5px] font-medium">
            Sign out
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
