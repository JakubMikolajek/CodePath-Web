import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { useState } from 'react'

interface LoginFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

interface LoginFormState {
  email: string
  password: string
}

export default function LoginForm({ handleShowRegisterForm }: LoginFormProps) {
  const [formData, setFormData] = useState<LoginFormState>({
    email: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={() => {}}>
            <div className="flex flex-col gap-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">{error}</div>
              )}

              <div className="grid gap-3">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  required
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
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
                  onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                  disabled={isLoading}
                />
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !formData.email || !formData.password}
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
