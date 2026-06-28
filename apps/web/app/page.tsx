'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

import LoginForm from '@/components/LoginForm'
import RegisterForm from '@/components/RegisterForm'

export default function HomePage() {
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false)
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'

  return (
    <main className="aurora-shell aurora-login flex min-h-svh w-full items-center justify-center overflow-hidden">
      <div aria-hidden="true" className="login-aurora">
        <span className="login-aurora-blob login-aurora-blob-1" />
        <span className="login-aurora-blob login-aurora-blob-2" />
        <span className="login-aurora-blob login-aurora-blob-3" />
        <span className="login-aurora-blob login-aurora-blob-4" />
      </div>

      <div className="relative z-10 flex w-full items-center justify-center px-5 py-8 md:px-10">
        <div className="w-full max-w-[430px]">
          {showRegisterForm ? <RegisterForm handleShowRegisterForm={setShowRegisterForm} /> : <LoginForm callbackUrl={callbackUrl} handleShowRegisterForm={setShowRegisterForm} />}
        </div>
      </div>
    </main>
  )
}
