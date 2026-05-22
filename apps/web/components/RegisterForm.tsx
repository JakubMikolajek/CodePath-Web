'use client'

import { Button } from '@workspace/ui/components/button'
import { Card, CardContent } from '@workspace/ui/components/card'
import { ArrowLeft, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { signIn } from 'next-auth/react'

import { BrandMark } from '@/components/BrandMark'

interface RegisterFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

export default function RegisterForm({ handleShowRegisterForm }: RegisterFormProps) {
  const startOidcRegistration = () => {
    void signIn('keycloak', { callbackUrl: `${window.location.origin}/dashboard` })
  }

  return (
    <Card className="login-card overflow-hidden rounded-[1.65rem] px-4 py-9 md:rounded-4xl md:px-14 md:py-12">
      <CardContent className="px-0">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark className="justify-center text-2xl md:text-3xl" />

          <h1 className="mt-10 text-4xl font-bold text-white md:text-[2.4rem]">Create account</h1>

          <p className="mt-3 text-lg text-muted-foreground">Create your account in Keycloak</p>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 text-sm text-primary-foreground">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="leading-6 text-white/86">
                Account creation is delegated to Keycloak. Use the registration option on the identity provider screen.
              </p>
            </div>
          </div>

          <Button
            className="h-14 w-full rounded-2xl text-base"
            onClick={startOidcRegistration}
            type="button"
            variant="glow"
          >
            <UserRoundPlus className="size-5" />
            Continue to registration
          </Button>

          <Button
            className="h-14 w-full rounded-2xl text-base"
            onClick={() => handleShowRegisterForm(false)}
            type="button"
            variant="outline"
          >
            <ArrowLeft className="size-5" />
            Back to sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
