import { z } from 'zod'

export const createRepoFormSchema = z.object({
  accessKey: z.string().min(1, 'Access key is required'),
  gitUrl: z.string().min(1, 'Repository url is required'),
  name: z.string().min(1, 'Repository name is required')
})

export type CreateRepoFormData = z.infer<typeof createRepoFormSchema>
