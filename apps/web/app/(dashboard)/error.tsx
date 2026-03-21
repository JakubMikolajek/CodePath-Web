'use client'

import { Button } from '@workspace/ui/components/button'
import { useEffect } from 'react'

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('Dashboard route error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-700">Dashboard crashed</h2>
        <p className="mt-2 text-sm text-red-700">
          Something went wrong while rendering this page. Try reloading the route.
        </p>
        <Button
          className="mt-4"
          onClick={reset}
          type="button"
          variant="outline"
        >
          Try again
        </Button>
      </div>
    </div>
  )
}
