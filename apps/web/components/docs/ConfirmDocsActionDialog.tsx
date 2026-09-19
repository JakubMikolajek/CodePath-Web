'use client'

import { Button } from '@workspace/ui/components/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@workspace/ui/components/dialog'
import { useEffect, useRef } from 'react'

import { CONFIRMABLE_DOCS_ACTION_COPY, type ConfirmableDocsAction } from './docsUtils'

interface ConfirmDocsActionDialogProps {
  action: ConfirmableDocsAction | null
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDocsActionDialog({ action, onCancel, onConfirm }: ConfirmDocsActionDialogProps) {
  const copy = action ? CONFIRMABLE_DOCS_ACTION_COPY[action] : null
  const returnFocusTo = useRef<HTMLElement | null>(null)

  // The dialog is controlled and has no Radix trigger, so remember the button that opened it.
  useEffect(() => {
    if (action !== null && document.activeElement instanceof HTMLElement) returnFocusTo.current = document.activeElement
  }, [action])

  return (
    <Dialog onOpenChange={open => { if (!open) onCancel() }} open={action !== null}>
      <DialogContent
        onCloseAutoFocus={event => {
          event.preventDefault()
          returnFocusTo.current?.focus()
        }}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{copy?.title}</DialogTitle>

          <DialogDescription>{copy?.description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button onClick={onCancel} type="button" variant="glass">Cancel</Button>

          <Button onClick={onConfirm} type="button" variant="destructive">{copy?.confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
