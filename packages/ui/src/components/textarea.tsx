import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-input/70 placeholder:text-muted-foreground/75 selection:bg-primary selection:text-primary-foreground flex field-sizing-content min-h-24 w-full rounded-xl border px-4 py-3 text-base text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.05)] transition-[border-color,box-shadow,background,color] outline-none focus-visible:border-ring focus-visible:bg-input focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
