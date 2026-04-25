import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Lock, Mail, UserRound } from 'lucide-react'
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
    <Card className="glass-panel-strong neon-border overflow-hidden rounded-[2rem] px-2 py-9 md:px-5 md:py-11">
      <CardContent className="px-5 md:px-8">
        <div className="mb-9 flex flex-col items-center text-center">
          <BrandMark />
          <h1 className="mt-9 text-3xl font-bold tracking-[-0.055em] text-white md:text-4xl">Welcome back</h1>
          <p className="mt-2 text-base text-muted-foreground">Log in to your account</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {currentError && (
            <div className="rounded-xl border border-destructive/45 bg-destructive/10 px-4 py-3 text-sm text-red-100" role="alert">
              {currentError}
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm text-white" htmlFor="identifier">Email or Login</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-invalid={Boolean(currentError)}
                autoComplete="username"
                className="h-14 pl-12 text-base"
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
            <Label className="text-sm text-white" htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-invalid={Boolean(currentError)}
                autoComplete="current-password"
                className="h-14 pl-12 text-base"
                disabled={loading}
                id="password"
                onChange={e => handleInputChange('password', e.target.value)}
                placeholder="Enter your password"
                required
                type="password"
                value={formData.password}
              />
            </div>
          </div>

          <Button
            className="h-14 w-full rounded-2xl text-base"
            disabled={loading || !formData.identifier || !formData.password}
            type="submit"
            variant="glow"
          >
            {loading ? 'Signing in...' : 'Log in'}
          </Button>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border/70" />
            <span>or</span>
            <span className="h-px flex-1 bg-border/70" />
          </div>

          <Button className="h-14 w-full rounded-2xl" disabled={loading} type="button" variant="outline">
            <UserRound className="size-5" />
            Sign in with SSO
          </Button>

          <p className="text-center text-sm text-muted-foreground">
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
