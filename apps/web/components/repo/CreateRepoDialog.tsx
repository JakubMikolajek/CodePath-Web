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

  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

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

    if (!open) form.reset()
  }

  return (
    <Dialog onOpenChange={handleDialogChange} open={dialogOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,29,44,0.96),rgba(13,17,26,0.98))] p-0 sm:max-w-[560px]">
        <div className="relative p-6 md:p-7">
          <DialogHeader>
            <div className="mb-3 grid size-10 place-items-center rounded-[11px] bg-[linear-gradient(135deg,var(--nurt-accent),var(--nurt-accent2))] text-[var(--nurt-ink)]">
              <Plus className="size-5" strokeWidth={2.2} />
            </div>

            <DialogTitle className="font-body text-xl font-bold tracking-normal text-[var(--nurt-title)]">Add New Repository</DialogTitle>

            <DialogDescription className="text-[12.5px] text-muted-foreground">
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
                        <Input className="border-primary/40 font-mono text-xs" placeholder="my-awesome-repo" {...field} />
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
                        <GitBranch className="size-4 text-muted-foreground" />
                        Branch (optional)
                      </FormLabel>

                      <FormControl>
                        <Input className="font-mono text-xs" placeholder="develop / main / master" {...field} />
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
                        <Input className="font-mono text-xs" placeholder="https://github.com/organization/repository.git" {...field} />
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
                        className="flex h-11 w-full rounded-[9px] border border-white/10 bg-input px-4 py-2 text-sm text-foreground outline-none transition-[border-color,box-shadow,background,color] focus-visible:border-primary/40 focus-visible:ring-[2px] focus-visible:ring-primary/20"
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
                        <Input className="font-mono text-xs" placeholder="oauth2 / x-access-token / your-user" {...field} />
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
                        {authType === 'ssh_key' ? <Textarea className="max-h-40" placeholder="-----BEGIN ... PRIVATE KEY-----" {...field} /> : <Input placeholder="Enter token" type="password" {...field} />}
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <DialogFooter className="border-t border-white/10 pt-5">
                <Button className="rounded-[9px]" disabled={isSubmitting} onClick={() => setDialogOpen(false)} type="button" variant="outline">
                  Cancel
                </Button>

                <Button className="rounded-[9px] border-primary/34 bg-primary/14 text-primary hover:bg-primary/20 hover:text-primary" disabled={isSubmitting} type="submit" variant="outline">
                  <Plus className="size-4" />
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
