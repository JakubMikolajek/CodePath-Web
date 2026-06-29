import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/75 selection:bg-primary selection:text-primary-foreground flex h-11 w-full min-w-0 rounded-[9px] border border-white/10 bg-input px-4 py-2 text-base text-foreground shadow-none transition-[border-color,box-shadow,background,color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-primary/40 focus-visible:ring-[2px] focus-visible:ring-primary/15",
        "aria-invalid:border-destructive/80 aria-invalid:ring-destructive/25",
        className
      )}
      {...props}
    />
  )
}

export { Input }
