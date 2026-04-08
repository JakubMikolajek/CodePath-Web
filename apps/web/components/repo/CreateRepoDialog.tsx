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
      <DialogContent className="sm:max-w-106.25">
        <DialogHeader>
          <DialogTitle>Add New Repository</DialogTitle>
          <DialogDescription>
            Add a new repository to your workspace. Fill in the repository details below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(handleSubmit)}>
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
              name="branch"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Branch (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="develop / main / master" {...field} />
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
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
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
                    <FormLabel>Auth Username</FormLabel>
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
                    <FormLabel>{authType === 'ssh_key' ? 'SSH Private Key' : 'Deploy Token / PAT'}</FormLabel>
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

            <DialogFooter>
              <Button disabled={isSubmitting} onClick={() => setDialogOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Adding...' : 'Add Repository'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
