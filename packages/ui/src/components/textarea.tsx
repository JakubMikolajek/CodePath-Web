import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-white/10 bg-input placeholder:text-muted-foreground/75 selection:bg-primary selection:text-primary-foreground flex field-sizing-content min-h-24 w-full rounded-[9px] border px-4 py-3 text-base text-foreground shadow-none transition-[border-color,box-shadow,background,color] outline-none focus-visible:border-primary/40 focus-visible:bg-input focus-visible:ring-[2px] focus-visible:ring-primary/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
