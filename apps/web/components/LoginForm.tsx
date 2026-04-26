import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Eye, Lock, Mail, UserRound } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { BrandMark } from '@/components/BrandMark'
import { useAppDispatch, useAppSelector } from '@/redux/hooks'
import { clearError, login } from '@/redux/slices/authSlice'

interface LoginFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

interface LoginFormState {
  identifier: string
  password: string
}

export default function LoginForm({ handleShowRegisterForm }: LoginFormProps) {
  const dispatch = useAppDispatch()
  const { error, loading } = useAppSelector(state => state.auth)
  const [fallbackError, setFallbackError] = useState<null | string>(null)
  const [formData, setFormData] = useState<LoginFormState>({
    identifier: '',
    password: ''
  })

  const currentError = error ?? fallbackError

  const handleInputChange = (field: keyof LoginFormState, value: string) => {
    if (error) dispatch(clearError())
    if (fallbackError) setFallbackError(null)
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await dispatch(login({
        identifier: formData.identifier,
        password: formData.password
      })).unwrap()
    } catch (submitError: unknown) {
      console.error('Login request failed', submitError)
      if (!error) setFallbackError('Login failed. Check your credentials and try again.')
    }
  }

  return (
    <Card className="login-card overflow-hidden rounded-[1.65rem] px-4 py-9 md:rounded-[2rem] md:px-14 md:py-12">
      <CardContent className="px-0">
        <div className="mb-8 flex flex-col items-center text-center md:mb-9">
          <BrandMark className="justify-center text-2xl md:text-3xl" />
          <h1 className="mt-12 text-4xl font-bold tracking-[-0.06em] text-white md:text-[2.65rem]">Welcome back</h1>
          <p className="mt-3 text-lg text-muted-foreground">Log in to your account</p>
        </div>

        <form className="space-y-7" onSubmit={handleSubmit}>
          {currentError && (
            <div className="rounded-xl border border-destructive/45 bg-destructive/10 px-4 py-3 text-sm text-red-100" role="alert">
              {currentError}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-base text-white" htmlFor="identifier">Email or Login</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-invalid={Boolean(currentError)}
                autoComplete="username"
                className="h-[4.1rem] rounded-2xl pl-16 text-xl"
                disabled={loading}
                id="identifier"
                onChange={e => handleInputChange('identifier', e.target.value)}
                placeholder="Enter email or login"
                required
                type="text"
                value={formData.identifier}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-base text-white" htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-invalid={Boolean(currentError)}
                autoComplete="current-password"
                className="h-[4.1rem] rounded-2xl pl-16 pr-14 text-xl"
                disabled={loading}
                id="password"
                onChange={e => handleInputChange('password', e.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={formData.password}
              />
              <Eye className="pointer-events-none absolute right-5 top-1/2 size-6 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <Button
            className="h-[4.1rem] w-full rounded-2xl text-xl shadow-[0_0_34px_oklch(0.62_0.24_270/0.5)]"
            disabled={loading || !formData.identifier || !formData.password}
            type="submit"
            variant="glow"
          >
            {loading ? 'Signing in...' : 'Log in'}
          </Button>

          <div className="flex items-center gap-5 text-base text-muted-foreground">
            <span className="h-px flex-1 bg-border/70" />
            <span>or</span>
            <span className="h-px flex-1 bg-border/70" />
          </div>

          <Button className="h-[4.1rem] w-full rounded-2xl text-xl" disabled={loading} type="button" variant="outline">
            <UserRound className="size-5" />
            Sign in with SSO
          </Button>

          <p className="text-center text-base text-muted-foreground">
            Don&apos;t have an account?{' '}
            <button
              className="font-semibold text-primary underline-offset-4 hover:text-accent hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => handleShowRegisterForm(true)}
              type="button"
            >
              Sign up
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
