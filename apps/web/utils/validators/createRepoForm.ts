import { z } from 'zod'

export const createRepoFormSchema = z.object({
  accessKey: z.string().optional(),
  authSecret: z.string().optional(),
  authType: z.enum(['https_token', 'none', 'ssh_key']),
  authUsername: z.string().optional(),
  branch: z.string().optional(),
  gitUrl: z.string().min(1, 'Repository url is required'),
  name: z.string().min(1, 'Repository name is required')
}).superRefine((value, ctx) => {
  if (value.authType === 'none') return

  const secret = value.authSecret?.trim() || value.accessKey?.trim()

  if (!secret) {
    ctx.addIssue({
      code: 'custom',
      message: 'Auth secret is required',
      path: ['authSecret']
    })
  }
})

export type CreateRepoFormData = z.infer<typeof createRepoFormSchema>
