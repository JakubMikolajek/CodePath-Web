import '@workspace/ui/styles/globals.css'

import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import { Providers } from '@/components/providers'

interface RootLayoutProps {
  children: ReactNode
}

export const metadata: Metadata = {
  description: 'Code intelligence cockpit for repositories, APIs, docs and dependency graphs.',
  title: 'CodePath'
}

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
