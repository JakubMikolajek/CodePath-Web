'use client'

import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { ArrowLeft, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { signIn } from 'next-auth/react'

import { BrandMark } from '@/components/BrandMark'

interface RegisterFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

export default function RegisterForm({ handleShowRegisterForm }: RegisterFormProps) {
  const startOidcRegistration = () => {
    void signIn('keycloak', { callbackUrl: '/dashboard' })
  }

  return (
    <div className={cn('w-full px-[34px] py-[34px] pb-[30px]')}>
      <div className="mb-8 flex flex-col items-center text-center">
        <BrandMark className="justify-center text-[18px]" />

        <h1 className="mt-[24px] font-mono text-[30px] font-bold leading-tight text-[var(--nurt-title)]">
          Create account
        </h1>
      </div>

      <div className="space-y-6">
        <div className="rounded-[11px] border border-white/[0.06] bg-white/[0.025] px-[13px] py-3">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-px size-[15px] shrink-0 text-primary" />
            <p className="text-xs leading-[1.5] text-muted-foreground">
              Account creation is delegated to Keycloak. Use the registration
              option on the identity provider screen.
            </p>
          </div>
        </div>

        <Button
          className="h-auto w-full rounded-[12px] border-primary/35 bg-primary/15 p-[13px] text-sm font-semibold text-primary hover:bg-primary/20 hover:text-primary"
          onClick={startOidcRegistration}
          type="button"
          variant="glow"
        >
          <UserRoundPlus className="size-5" />
          Sign up
        </Button>

        <Button
          className="h-auto w-full rounded-[12px] p-[13px] text-sm"
          onClick={() => handleShowRegisterForm(false)}
          type="button"
          variant="outline"
        >
          <ArrowLeft className="size-5" />
          Back to sign in
        </Button>
      </div>
    </div>
  )
}
