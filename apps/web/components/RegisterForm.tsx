
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import type { FormEvent } from 'react'
import { useState } from 'react'

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
  const [formData, setFormData] = useState<RegisterFormState>({
    email: '',
    login: '',
    password: ''
  })
  const [success, setSuccess] = useState(false)

  const handleInputChange = (field: keyof RegisterFormState, value: string) => {
    if (error) dispatch(clearError())
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSuccess(false)

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
    } catch {
      // TODO add error handling
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Enter your details to register</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">{error}</div>
              )}
              {success && (
                <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
                  Registration successful! Redirecting to login...
                </div>
              )}
              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  disabled={loading}
                  id="email"
                  onChange={e => handleInputChange('email', e.target.value)}
                  placeholder="your@email.com"
                  required
                  type="email"
                  value={formData.email}
                />
              </div>
              <div className="grid gap-3">
                <Label htmlFor="login">Login</Label>
                <Input
                  disabled={loading}
                  id="login"
                  onChange={e => handleInputChange('login', e.target.value)}
                  placeholder="Choose a username"
                  required
                  type="text"
                  value={formData.login}
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
                  disabled={loading || !formData.email || !formData.login || !formData.password}
                  type="submit"
                >
                  {loading ? 'Registering...' : 'Register'}
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <span
                className="underline underline-offset-4 cursor-pointer hover:text-primary"
                onClick={() => handleShowRegisterForm(false)}
              >
                Sign in
              </span>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
