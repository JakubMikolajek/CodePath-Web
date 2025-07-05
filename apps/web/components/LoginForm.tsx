
import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

import { useAuthStore } from '@/store'

interface LoginFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

interface LoginFormState {
  identifier: string
  password: string
}

export default function LoginForm({ handleShowRegisterForm }: LoginFormProps) {
  const { login, loading } = useAuthStore()
  const router = useRouter()

  const [formData, setFormData] = useState<LoginFormState>({
    identifier: '',
    password: '',
  })

  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: keyof LoginFormState, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    await login(formData.identifier, formData.password)
    router.push('/dashboard')
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
                  disabled={loading || !formData.identifier || !formData.password}
                >
                  {loading ? 'Signing in...' : 'Login'}
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
