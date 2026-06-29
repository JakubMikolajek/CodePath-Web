'use client'

import { useState } from 'react'

import LoginForm from '@/components/LoginForm'
import RegisterForm from '@/components/RegisterForm'

interface LoginPageContentProps {
  callbackUrl: string
}

export default function LoginPageContent({ callbackUrl }: LoginPageContentProps) {
  const [showRegisterForm, setShowRegisterForm] = useState<boolean>(false)

  return showRegisterForm ? <RegisterForm handleShowRegisterForm={setShowRegisterForm} /> : <LoginForm callbackUrl={callbackUrl} handleShowRegisterForm={setShowRegisterForm} />
}
