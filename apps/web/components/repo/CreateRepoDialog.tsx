'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@workspace/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@workspace/ui/components/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@workspace/ui/components/form'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'
import { GitBranch, KeyRound, LockKeyhole, Plus, ShieldCheck } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useForm } from 'react-hook-form'

import { useAppDispatch } from '@/redux/hooks'
import { createRepo } from '@/redux/slices/reposSlice'
import type { CreateRepoFormData } from '@/utils/validators/createRepoForm'
import { createRepoFormSchema } from '@/utils/validators/createRepoForm'

interface CreateRepoDialogProps {
  children: ReactNode
}

export default function CreateRepoDialog({ children }: CreateRepoDialogProps) {
  const dispatch = useAppDispatch()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateRepoFormData>({
    resolver: zodResolver(createRepoFormSchema),
    defaultValues: {
      accessKey: '',
      authSecret: '',
      authType: 'https_token',
      authUsername: 'oauth2',
      branch: '',
      gitUrl: '',
      name: ''
    }
  })
  const authType = form.watch('authType')

  const handleSubmit = async (data: CreateRepoFormData) => {
    try {
      setIsSubmitting(true)

      await dispatch(createRepo(data)).unwrap()

      setDialogOpen(false)
      form.reset()
    } catch (error) {
      console.error('Error adding repository:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      form.reset()
    }
  }

  return (
    <Dialog onOpenChange={handleDialogChange} open={dialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="glass-panel-strong overflow-hidden rounded-[2rem] border-primary/30 p-0 sm:max-w-2xl">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative p-6 md:p-7">
          <DialogHeader>
            <div className="mb-2 grid size-12 place-items-center rounded-2xl border border-primary/35 bg-primary/15 text-primary shadow-[0_0_28px_oklch(0.62_0.24_270/0.28)]">
              <Plus className="size-5" />
            </div>
            <DialogTitle className="text-2xl tracking-[-0.05em] text-white">Add New Repository</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a new repository to your workspace. Fill in the repository details below.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="mt-6 space-y-5" onSubmit={form.handleSubmit(handleSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Repository Name</FormLabel>
                      <FormControl>
                        <Input placeholder="my-awesome-repo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="branch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <GitBranch className="size-4 text-cyan-300" />
                        Branch (optional)
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="develop / main / master" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="gitUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Git URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://github.com/organization/repository.git" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="authType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Auth Method</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-11 w-full rounded-xl border border-input bg-input/70 px-4 py-2 text-sm text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.05)] outline-none transition-[border-color,box-shadow,background,color] focus-visible:border-ring focus-visible:bg-input focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        {...field}
                      >
                        <option value="https_token">HTTPS Token (recommended)</option>
                        <option value="ssh_key">SSH Private Key (legacy)</option>
                        <option value="none">No auth (public repository)</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {authType === 'https_token' && (
                <FormField
                  control={form.control}
                  name="authUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-emerald-300" />
                        Auth Username
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="oauth2 / x-access-token / your-user" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {authType !== 'none' && (
                <FormField
                  control={form.control}
                  name="authSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        {authType === 'ssh_key' ? <LockKeyhole className="size-4 text-amber-300" /> : <KeyRound className="size-4 text-amber-300" />}
                        {authType === 'ssh_key' ? 'SSH Private Key' : 'Deploy Token / PAT'}
                      </FormLabel>
                      <FormControl>
                        {authType === 'ssh_key'
                          ? <Textarea className="max-h-40" placeholder="-----BEGIN ... PRIVATE KEY-----" {...field} />
                          : <Input placeholder="Enter token" type="password" {...field} />}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter className="border-t border-white/10 pt-5">
                <Button disabled={isSubmitting} onClick={() => setDialogOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>
                <Button disabled={isSubmitting} type="submit" variant="glow">
                  {isSubmitting ? 'Adding...' : 'Add Repository'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
