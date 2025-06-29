'use client'

import { useState } from 'react'

import LoginForm from '@/components/LoginForm'
import RegisterForm from '@/components/RegisterForm'

export default function Page() {
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false)

  const handleShowRegisterForm = (value: boolean) => {
    setShowRegisterForm(value)
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        {showRegisterForm ?
          <RegisterForm handleShowRegisterForm={handleShowRegisterForm}/>
          : <LoginForm handleShowRegisterForm={handleShowRegisterForm}/>
        }
      </div>
    </div>
  )
}
