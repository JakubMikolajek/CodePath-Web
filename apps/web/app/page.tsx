'use client'

import { useState } from 'react'

import LoginForm from '@/components/LoginForm'
import RegisterForm from '@/components/RegisterForm'

export default function HomePage() {
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false)

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {showRegisterForm
          ? <RegisterForm handleShowRegisterForm={setShowRegisterForm}/>
          : <LoginForm handleShowRegisterForm={setShowRegisterForm}/>
        }
      </div>
    </div>
  )
}
