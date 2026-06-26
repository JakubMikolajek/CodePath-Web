import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-[-0.01em] transition-all duration-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 focus-visible:ring-offset-0 aria-invalid:ring-destructive/30 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-primary/50 bg-[linear-gradient(135deg,oklch(0.64_0.24_258),oklch(0.62_0.25_288))] text-primary-foreground hover:brightness-110 active:scale-[0.99]",
        glow:
          "border border-primary/50 bg-[linear-gradient(135deg,oklch(0.64_0.24_258),oklch(0.62_0.25_288))] text-primary-foreground hover:translate-y-[-1px] hover:brightness-110",
        destructive:
          "border border-destructive/50 bg-destructive/85 text-white shadow-[0_0_24px_oklch(0.64_0.22_25/0.25)] hover:bg-destructive",
        outline:
          "border border-border/80 bg-background/20 text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.07)] hover:border-primary/60 hover:bg-primary/10 hover:text-white",
        secondary:
          "border border-border/80 bg-secondary/70 text-secondary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.08)] hover:border-primary/50 hover:bg-secondary",
        glass:
          "glass-panel text-foreground hover:border-primary/60 hover:bg-primary/10 hover:text-white",
        ghost:
          "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-foreground",
        nav:
          "justify-start rounded-xl px-3 text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground data-[active=true]:border data-[active=true]:border-primary/45 data-[active=true]:bg-[linear-gradient(135deg,oklch(0.58_0.22_258/0.92),oklch(0.45_0.2_285/0.72))] data-[active=true]:text-white",
        link: "text-primary underline-offset-4 hover:text-accent hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-12 rounded-xl px-6 text-base has-[>svg]:px-4",
        xl: "h-14 rounded-2xl px-7 text-base has-[>svg]:px-5",
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
