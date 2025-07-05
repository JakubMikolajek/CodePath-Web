
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import axios from 'axios'
import { FormEvent, useState } from 'react'

import { useAuthStore } from '@/store'

interface RegisterFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

interface RegisterFormState {
  email: string
  login: string
  password: string
}

export default function RegisterForm({ handleShowRegisterForm }: RegisterFormProps) {
  const { register, loading } = useAuthStore()
  const [formData, setFormData] = useState<RegisterFormState>({
    email: '',
    login: '',
    password: '',
  })

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleInputChange = (field: keyof RegisterFormState, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    try {
      await register(formData.email, formData.login, formData.password)
      handleShowRegisterForm(false)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed.')
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
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
                  Registration successful!
                </div>
              )}

              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="login">Login</Label>
                <Input
                  id="login"
                  type="text"
                  placeholder="Choose a username"
                  required
                  value={formData.login}
                  onChange={(e) => handleInputChange('login', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  required
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !formData.email || !formData.login || !formData.password}
                >
                  {loading ? 'Registering...' : 'Register'}
                </Button>
              </div>
            </div>

            <div className="mt-4 text-center text-sm">
              Already have an account?{' '}
              <span
                onClick={() => handleShowRegisterForm(false)}
                className="underline underline-offset-4 cursor-pointer"
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
