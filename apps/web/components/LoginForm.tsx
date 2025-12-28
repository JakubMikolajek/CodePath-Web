
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import type { FormEvent } from 'react'
import { useState } from 'react'

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
  const [formData, setFormData] = useState<LoginFormState>({
    identifier: '',
    password: ''
  })

  const handleInputChange = (field: keyof LoginFormState, value: string) => {
    if (error) dispatch(clearError())
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await dispatch(login({
        identifier: formData.identifier,
        password: formData.password
      })).unwrap()
    } catch {
      // TODO add error log
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">{error}</div>
              )}
              <div className="grid gap-3">
                <Label htmlFor="identifier">Email or Login</Label>
                <Input
                  disabled={loading}
                  id="identifier"
                  onChange={e => handleInputChange('identifier', e.target.value)}
                  placeholder="Enter email or login"
                  required
                  type="text"
                  value={formData.identifier}
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="password">Password</Label>
                <Input
                  disabled={loading}
                  id="password"
                  onChange={e => handleInputChange('password', e.target.value)}
                  placeholder="Enter your password"
                  required
                  type="password"
                  value={formData.password}
                />
              </div>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full"
                  disabled={loading || !formData.identifier || !formData.password}
                  type="submit"
                >
                  {loading ? 'Signing in...' : 'Login'}
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{' '}
              <span
                className="underline underline-offset-4 cursor-pointer hover:text-primary"
                onClick={() => handleShowRegisterForm(true)}
              >
                Sign up
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
