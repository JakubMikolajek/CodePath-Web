import { PrintDocsClient } from '@/components/docs/PrintDocsClient'

interface PrintDocsPageProps {
  params: Promise<{ repoId: string }>
  searchParams: Promise<{ autoprint?: string }>
}

export default async function Page({ params, searchParams }: PrintDocsPageProps) {
  const [{ repoId }, { autoprint }] = await Promise.all([params, searchParams])

  return <PrintDocsClient repoIdParam={repoId} shouldAutoPrint={autoprint === '1'} />
}
