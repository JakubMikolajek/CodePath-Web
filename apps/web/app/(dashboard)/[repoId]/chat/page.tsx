'use client'

import { useParams } from 'next/navigation'

export default function Page() {
  const params = useParams()
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Chat</h1>
          <p className="text-muted-foreground">{params.repoId}</p>
        </div>
      </div>
    </>
  )
}

