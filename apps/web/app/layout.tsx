import '@workspace/ui/styles/globals.css'

import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import type { ReactNode } from 'react'

import { Providers } from '@/components/Providers'

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist'
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono'
})

interface RootLayoutProps {
  children: ReactNode
}

export const metadata: Metadata = {
  description: 'Code intelligence cockpit for repositories, APIs, docs and dependency graphs.',
  title: 'Nurt Cloud'
}

export default function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html className={`${geist.variable} ${geistMono.variable}`} lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
