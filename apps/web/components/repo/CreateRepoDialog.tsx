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
  DialogTrigger,
} from '@workspace/ui/components/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@workspace/ui/components/form'
import { Input } from '@workspace/ui/components/input'
import { Textarea } from '@workspace/ui/components/textarea'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'

import { useReposStore } from '@/store'
import { CreateRepoFormData, createRepoFormSchema } from '@/utils/validators/createRepoForm'

interface CreateRepoDialogProps {
  children: ReactNode
}

export default function CreateRepoDialog({ children }: CreateRepoDialogProps) {
  const { createRepo } = useReposStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CreateRepoFormData>({
    resolver: zodResolver(createRepoFormSchema),
    defaultValues: {
      name: '',
      gitUrl: '',
      accessKey: '',
    },
  })

  const handleSubmit = async (data: CreateRepoFormData) => {
    try {
      setIsSubmitting(true)

      await createRepo(data)

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
    <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Repository</DialogTitle>
          <DialogDescription>
            Add a new repository to your workspace. Fill in the repository details below.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                    <Input placeholder="git@github.com/username/repo.git" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accessKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Access Key</FormLabel>
                  <FormControl>
                    <Textarea className="max-h-40" placeholder="Enter access key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Repository'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
