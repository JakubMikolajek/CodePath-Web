'use client'

import { useCallback, useEffect, useState } from 'react'

export enum Accent {
  BLUE = 'blue',
  VIOLET = 'violet',
  TEAL = 'teal',
  ORANGE = 'orange',
}

export const ACCENT_PRESETS = [
  { key: Accent.BLUE,   label: 'Blue',   swatch: 'linear-gradient(135deg,#4ea3f5,#8b5cf6)', ring: '#4ea3f5' },
  { key: Accent.VIOLET, label: 'Violet', swatch: 'linear-gradient(135deg,#a78bfa,#ec4899)', ring: '#a78bfa' },
  { key: Accent.TEAL,   label: 'Teal',   swatch: 'linear-gradient(135deg,#2dd4bf,#06b6d4)', ring: '#2dd4bf' },
  { key: Accent.ORANGE, label: 'Orange', swatch: 'linear-gradient(135deg,#fb923c,#f59e0b)', ring: '#fb923c' },
] as const

const STORAGE_KEY = 'nurt-accent'
const DEFAULT_ACCENT = Accent.BLUE

const ACCENT_VALUES = new Set<string>(Object.values(Accent))

function parseAccent(raw: string | null): Accent {
  return raw !== null && ACCENT_VALUES.has(raw) ? (raw as Accent) : DEFAULT_ACCENT
}

export function useAccentTheme() {
  const [accent, setAccentState] = useState<Accent>(DEFAULT_ACCENT)

  useEffect(() => {
    const stored = parseAccent(localStorage.getItem(STORAGE_KEY))
    document.documentElement.dataset.accent = stored
    setAccentState(stored)
  }, [])

  const setAccent = useCallback((key: Accent) => {
    localStorage.setItem(STORAGE_KEY, key)
    document.documentElement.dataset.accent = key
    setAccentState(key)
  }, [])

  return { accent, setAccent }
}
