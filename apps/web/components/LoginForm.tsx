
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import axios from 'axios'
import { useState } from 'react'

interface LoginFormProps {
  handleShowRegisterForm: (value: boolean) => void
  onLoginSuccess?: (token: string) => void // opcjonalny callback np. do zapisania tokenu
}

interface LoginFormState {
  identifier: string
  password: string
}

export default function LoginForm({ handleShowRegisterForm, onLoginSuccess }: LoginFormProps) {
  const [formData, setFormData] = useState<LoginFormState>({
    identifier: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: keyof LoginFormState, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const response = await axios.post('/api/auth/login', {
        identifier: formData.identifier,
        password: formData.password,
      })

      const token = response.data.access_token
      if (token) {
        localStorage.setItem('access_token', token) // 🔐 lub useCookies / Zustand itd.
        onLoginSuccess?.(token)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed.')
    } finally {
      setIsLoading(false)
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
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
                </div>
              )}

              <div className="grid gap-3">
                <Label htmlFor="identifier">Email or Login</Label>
                <Input
                  id="identifier"
                  type="text"
                  placeholder="Enter email or login"
                  required
                  value={formData.identifier}
                  onChange={(e) => handleInputChange('identifier', e.target.value)}
                  disabled={isLoading}
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
                  disabled={isLoading}
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !formData.identifier || !formData.password}
                >
                  {isLoading ? 'Signing in...' : 'Login'}
                </Button>
              </div>
            </div>

            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account?{' '}
              <span
                onClick={() => handleShowRegisterForm(true)}
                className="underline underline-offset-4 cursor-pointer"
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
