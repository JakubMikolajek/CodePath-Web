'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { ReactNode } from 'react'

import AuthProvider from '@/components/providers/AuthContext'
import RQProvider from '@/components/providers/RQProvider'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      enableColorScheme
    >
      <AuthProvider>
        <RQProvider>
          {children}
        </RQProvider>
      </AuthProvider>
    </NextThemesProvider>
  )
}
