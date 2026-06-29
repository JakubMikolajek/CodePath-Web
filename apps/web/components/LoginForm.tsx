'use client'

import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { LogIn, ShieldCheck } from 'lucide-react'
import { signIn } from 'next-auth/react'

import { BrandMark } from '@/components/BrandMark'

interface LoginFormProps {
  callbackUrl?: string
  handleShowRegisterForm: (value: boolean) => void
}

export default function LoginForm({ callbackUrl = '/dashboard', handleShowRegisterForm }: LoginFormProps) {
  const startOidcLogin = () => {
    void signIn('keycloak', { callbackUrl })
  }

  return (
    <div className={cn('w-full px-[34px] py-[34px] pb-[30px]')}>
      <div className="mb-6 flex flex-col items-center text-center">
        <BrandMark className="justify-center text-[18px]" />

        <h1 className="mt-[24px] font-mono text-[30px] font-bold leading-tight text-[var(--nurt-title)]">
          Welcome back
        </h1>
      </div>

      <div>
        <div className="mb-[18px] rounded-[11px] border border-white/[0.06] bg-white/[0.025] px-[13px] py-3">
          <div className="flex items-start gap-[9px]">
            <ShieldCheck className="mt-px size-[15px] shrink-0 text-primary" />

            <p className="text-xs leading-[1.5] text-muted-foreground">
              Authentication is handled through OpenID Connect. Nurt Cloud does
              not collect your password here.
            </p>
          </div>
        </div>

        <Button
          className="h-auto w-full rounded-[12px] border-primary/35 bg-primary/15 p-[13px] text-sm font-semibold text-primary hover:bg-primary/20 hover:text-primary"
          onClick={startOidcLogin}
          type="button"
          variant="outline"
        >
          <LogIn className="size-4" />
          Sign in
        </Button>

        <p className="mt-[18px] text-center text-[12.5px] text-muted-foreground">
          Don&apos;t have an account?{' '}
          <button
            className="font-medium text-primary underline-offset-4 hover:text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => handleShowRegisterForm(true)}
            type="button"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  )
}
