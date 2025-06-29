import { Button } from '@workspace/ui/components/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { useState } from 'react'

interface RegisterFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

interface RegisterFormState {
  email: string
  login: string
  password: string
}

export default function RegisterForm({ handleShowRegisterForm }: RegisterFormProps) {
  const [formData, setFormData] = useState<RegisterFormState>({
    email: '',
    login: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (field: keyof RegisterFormState, value: string) => {
    setFormData({ ...formData, [field]: value })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>Enter your details to register</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={() => {}}>
            <div className="flex flex-col gap-6">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {error}
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
                  disabled={isLoading}
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
                  disabled={isLoading || !formData.email || !formData.login || !formData.password}
                >
                  {isLoading ? 'Registering...' : 'Register'}
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
