'use server'

import { Geist, Geist_Mono } from 'next/font/google'
import '@workspace/ui/globals.css'
import { ReactNode } from 'react'

import { Providers } from '@/components/providers'
import AuthChecker from '@/components/providers/AuthChecker'

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const fontMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

interface RootLayoutProps {
  children: ReactNode
}

export default async function RootLayout({ children }: Readonly<RootLayoutProps>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontSans.variable} ${fontMono.variable} font-sans antialiased `}>
        <Providers>
          {children}
          <AuthChecker />
        </Providers>
      </body>
    </html>
  )
}
