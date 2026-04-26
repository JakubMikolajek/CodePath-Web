import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { AtSign, Lock, UserRound } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { BrandMark } from '@/components/BrandMark'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { clearError, register } from '@/redux/slices/authSlice'

interface RegisterFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

interface RegisterFormState {
  email: string
  login: string
  password: string
}

export default function RegisterForm({ handleShowRegisterForm }: RegisterFormProps) {
  const dispatch = useAppDispatch()
  const { error, loading } = useAppSelector(state => state.auth)
  const [fallbackError, setFallbackError] = useState<null | string>(null)
  const [formData, setFormData] = useState<RegisterFormState>({
    email: '',
    login: '',
    password: ''
  })
  const [success, setSuccess] = useState(false)
  const currentError = error ?? fallbackError

  const handleInputChange = (field: keyof RegisterFormState, value: string) => {
    if (error) dispatch(clearError())
    if (fallbackError) setFallbackError(null)
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSuccess(false)
    setFallbackError(null)

    try {
      await dispatch(register({
        email: formData.email,
        login: formData.login,
        password: formData.password
      })).unwrap()
      setSuccess(true)
      setTimeout(() => {
        handleShowRegisterForm(false)
      }, 1500)
    } catch (submitError: unknown) {
      console.error('Registration request failed', submitError)
      if (!error) setFallbackError('Registration failed. Check the form and try again.')
    }
  }

  return (
    <Card className="login-card overflow-hidden rounded-[1.65rem] px-4 py-9 md:rounded-[2rem] md:px-14 md:py-12">
      <CardContent className="px-0">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark className="justify-center text-2xl md:text-3xl" />
          <h1 className="mt-10 text-4xl font-bold tracking-[-0.06em] text-white md:text-[2.4rem]">Create account</h1>
          <p className="mt-3 text-lg text-muted-foreground">Set up your CodePath workspace</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          {currentError && (
            <div className="rounded-xl border border-destructive/45 bg-destructive/10 px-4 py-3 text-sm text-red-100" role="alert">
              {currentError}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100" role="status">
              Registration successful. Redirecting to login...
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm text-white" htmlFor="email">Email</Label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-14 rounded-2xl pl-12 text-base" disabled={loading} id="email" onChange={e => handleInputChange('email', e.target.value)} placeholder="you@example.com" required type="email" value={formData.email} />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm text-white" htmlFor="login">Login</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-14 rounded-2xl pl-12 text-base" disabled={loading} id="login" onChange={e => handleInputChange('login', e.target.value)} placeholder="workspace-owner" required type="text" value={formData.login} />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm text-white" htmlFor="register-password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input className="h-14 rounded-2xl pl-12 text-base" disabled={loading} id="register-password" onChange={e => handleInputChange('password', e.target.value)} placeholder="Enter your password" required type="password" value={formData.password} />
            </div>
          </div>

          <Button className="h-14 w-full rounded-2xl text-base" disabled={loading || !formData.email || !formData.login || !formData.password} type="submit" variant="glow">
            {loading ? 'Creating...' : 'Create account'}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button className="font-semibold text-primary underline-offset-4 hover:text-accent hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => handleShowRegisterForm(false)} type="button">
              Sign in
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
