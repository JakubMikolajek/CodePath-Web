'use client'

import { useState } from 'react'

import { GsapAurora } from '@/components/GsapAurora'
import LoginForm from '@/components/LoginForm'
import RegisterForm from '@/components/RegisterForm'

export default function HomePage() {
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false)

  return (
    <main className="aurora-shell flex min-h-svh w-full items-center justify-center overflow-hidden p-5 md:p-10">
      <GsapAurora density="hero" />
      <div className="relative z-10 w-full max-w-[31rem]">
        {showRegisterForm
          ? <RegisterForm handleShowRegisterForm={setShowRegisterForm}/>
          : <LoginForm handleShowRegisterForm={setShowRegisterForm}/>
        }
      </div>
    </main>
  )
}
