import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@workspace/ui/components/popover'
import { ReactNode, MouseEvent } from 'react'

interface PopoverWrapperProps {
  trigger: ReactNode
  children: ReactNode
  asChild?: boolean
}

export default function PopoverWrapper({ trigger, children, asChild }: PopoverWrapperProps) {
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
