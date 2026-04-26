'use client'

import { useState } from 'react'

import { GsapAurora, GsapAuroraDensity } from '@/components/GsapAurora'
import LoginForm from '@/components/LoginForm'
import RegisterForm from '@/components/RegisterForm'

export default function HomePage() {
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false)

  return (
    <main className="aurora-shell aurora-login flex min-h-svh w-full items-center justify-center overflow-hidden">
      <GsapAurora density={GsapAuroraDensity.HERO} />

      <div className="login-artboard relative z-10 flex items-center justify-center px-5 py-8 md:px-10">
        <div className="w-full max-w-162">
          {showRegisterForm ? <RegisterForm handleShowRegisterForm={setShowRegisterForm}/> : <LoginForm handleShowRegisterForm={setShowRegisterForm}/>}
        </div>
      </div>
    </main>
  )
}
