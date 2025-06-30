'use client'

import { Button } from '@workspace/ui/components/button'

import { useAuth } from '@/components/providers/AuthContext'

export default function Page() {
  const { user, loading, logout } = useAuth()

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Detailed analytics and insights</p>
          <p>{user?.login}</p>
          <Button onClick={logout}>Logout</Button>
        </div>
      </div>
    </>
  )
}

