'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip'
import { ReactNode } from 'react'

interface TooltipWrapperProps {
  trigger: ReactNode
  children: ReactNode
}

export default function TooltipWrapper({ trigger, children }: TooltipWrapperProps) {
  return (
    <Tooltip>
      <TooltipTrigger>{trigger}</TooltipTrigger>
      <TooltipContent>
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
