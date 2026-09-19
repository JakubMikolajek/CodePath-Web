import { Button } from '@workspace/ui/components/button'
import { CalendarDays } from 'lucide-react'

import { DashboardContent } from '@/components/dashboard/DashboardContent'
import { PageHeader } from '@/components/PageHeader'
import { SystemStatusPanel } from '@/components/SystemStatusPanel'

export default function Page() {
  return (
    <div className="space-y-4.5">
      <PageHeader
        actions={(
          <Button className="rounded-[9px] px-3.25 py-2 text-[12.5px]" variant="glass">
            <CalendarDays className="size-3.25" />
            This week
          </Button>
        )}
        description="Detailed analytics and insights across repositories, APIs, AI sessions and generated documentation."
        title="Dashboard"
      />

      <DashboardContent>
        <SystemStatusPanel />
      </DashboardContent>
    </div>
  )
}
