'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { Provider } from 'react-redux'

import { store } from '@/redux/store'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <Provider store={store}>
        <NextThemesProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableColorScheme
          enableSystem={false}
          forcedTheme={undefined}
        >
          {children}
        </NextThemesProvider>
      </Provider>
    </SessionProvider>
  )
}
