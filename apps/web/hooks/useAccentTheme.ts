'use client'

import { useCallback, useEffect, useState } from 'react'

export enum Accent {
  BLUE = 'blue',
  ORANGE = 'orange',
  TEAL = 'teal',
  VIOLET = 'violet',
}

export const ACCENT_PRESETS = [
  { key: Accent.BLUE, label: 'Blue', ring: '#4ea3f5', swatch: 'linear-gradient(135deg,#4ea3f5,#8b5cf6)' },
  { key: Accent.VIOLET, label: 'Violet', ring: '#a78bfa', swatch: 'linear-gradient(135deg,#a78bfa,#ec4899)' },
  { key: Accent.TEAL, label: 'Teal', ring: '#2dd4bf', swatch: 'linear-gradient(135deg,#2dd4bf,#06b6d4)' },
  { key: Accent.ORANGE, label: 'Orange', ring: '#fb923c', swatch: 'linear-gradient(135deg,#fb923c,#f59e0b)' }
] as const

const STORAGE_KEY = 'nurt-accent'
const DEFAULT_ACCENT = Accent.BLUE

const ACCENT_VALUES = new Set<string>(Object.values(Accent))

function parseAccent(raw: null | string): Accent {
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
