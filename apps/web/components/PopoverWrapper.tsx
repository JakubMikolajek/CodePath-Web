import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@workspace/ui/components/popover'
import type { MouseEvent, ReactNode } from 'react'

interface PopoverWrapperProps {
  asChild?: boolean
  children: ReactNode
  trigger: ReactNode
}

export default function PopoverWrapper({ asChild, children, trigger }: PopoverWrapperProps) {
  const stopPropagation = (e: MouseEvent) => e.stopPropagation()

  return (
    <Popover>
      <PopoverTrigger asChild={asChild} onClick={stopPropagation} onPointerDown={stopPropagation}>
        {trigger}
      </PopoverTrigger>

      <PopoverContent onClick={stopPropagation} onPointerDown={stopPropagation}>
        {children}
      </PopoverContent>
    </Popover>
  )
}
