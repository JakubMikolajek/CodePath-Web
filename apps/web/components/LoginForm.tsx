'use client'

import { Button } from '@workspace/ui/components/button'
import { cn } from '@workspace/ui/lib/utils'
import { LogIn, ShieldCheck, UserRoundPlus } from 'lucide-react'
import { signIn } from 'next-auth/react'

import { BrandMark } from '@/components/BrandMark'

interface LoginFormProps {
  handleShowRegisterForm: (value: boolean) => void
}

export default function LoginForm({ handleShowRegisterForm }: LoginFormProps) {
  const startOidcLogin = () => {
    void signIn('keycloak', { callbackUrl: '/dashboard' })
  }

  return (
    <div className={cn('w-full px-4 py-9 md:px-14 md:py-12')}>
      <div className="mb-8 flex flex-col items-center text-center md:mb-9">
        <BrandMark className="justify-center text-2xl md:text-3xl" />

        <h1 className="mt-12 font-mono text-4xl font-bold text-white md:text-[2.65rem]">
          Welcome back
        </h1>
      </div>

      <div className="space-y-7">
        <div className="rounded-2xl border border-primary/25 bg-primary/10 px-4 py-4 text-sm text-primary-foreground">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />

            <p className="font-mono leading-6 text-white/86">
              Authentication is handled through OpenID Connect. Nurt Cloud does
              not collect your password here.
            </p>
          </div>
        </div>

        <Button
          className="h-[4.1rem] w-full rounded-2xl text-xl"
          onClick={startOidcLogin}
          type="button"
          variant="outline"
        >
          <LogIn className="size-5" />
          Sign in
        </Button>

        <p className="text-center text-base text-muted-foreground">
          Don&apos;t have an account?{' '}
          <button
            className="inline-flex items-center gap-2 font-semibold text-primary underline-offset-4 hover:text-accent hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => handleShowRegisterForm(true)}
            type="button"
          >
            <UserRoundPlus className="size-4" />
            Sign up
          </button>
        </p>
      </div>
    </div>
  )
}
