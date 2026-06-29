import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[9px] text-sm font-medium tracking-normal transition-colors duration-150 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-[2px] focus-visible:ring-primary/30 focus-visible:ring-offset-0 aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-primary/35 bg-primary/15 text-primary hover:bg-primary/20",
        glow:
          "border border-primary/35 bg-primary/15 text-primary hover:bg-primary/20",
        destructive:
          "border border-destructive/50 bg-destructive/85 text-white hover:bg-destructive",
        outline:
          "border border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06] hover:text-foreground",
        secondary:
          "border border-border/80 bg-secondary/70 text-secondary-foreground hover:border-primary/50 hover:bg-secondary",
        glass:
          "border border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06] hover:text-foreground",
        ghost:
          "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground",
        nav:
          "justify-start rounded-[9px] px-3 text-muted-foreground hover:bg-white/[0.03] hover:text-foreground data-[active=true]:border data-[active=true]:border-primary/30 data-[active=true]:bg-primary/15 data-[active=true]:text-primary",
        link: "text-primary underline-offset-4 hover:text-accent hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-[8px] gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-12 rounded-[9px] px-6 text-base has-[>svg]:px-4",
        xl: "h-14 rounded-[12px] px-7 text-base has-[>svg]:px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
