import * as z from 'zod'


export const createRepoFormSchema = z.object({
  name: z.string().min(1, 'Repository name is required'),
  gitUrl: z.string().min(1, 'Repository url is required'),
  accessKey: z.string().min(1, 'Access key is required'),
})

export type CreateRepoFormData = z.infer<typeof createRepoFormSchema>
