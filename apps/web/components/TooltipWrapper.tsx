'use client'

import { Tooltip, TooltipContent, TooltipTrigger } from '@workspace/ui/components/tooltip'
import type { ReactNode } from 'react'

interface TooltipWrapperProps {
  children: ReactNode
  trigger: ReactNode
}

export default function TooltipWrapper({ children, trigger }: TooltipWrapperProps) {
  return (
    <Tooltip>
      <TooltipTrigger>{trigger}</TooltipTrigger>
      <TooltipContent>
        {children}
      </TooltipContent>
    </Tooltip>
  )
}
