import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap outline-none select-none transition-[transform,opacity,background-color] duration-100 active:not-aria-[haspopup]:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        /** Filled, tinted: the one primary action on a screen. */
        default: "bg-primary text-primary-foreground font-semibold active:opacity-85",
        /** Gray filled: secondary actions. */
        secondary: "bg-fill text-foreground font-semibold active:bg-fill-strong",
        /** Tinted text on a light tint: prominent but not primary. */
        tinted: "bg-accent text-accent-foreground font-semibold active:opacity-80",
        outline: "border border-border bg-card text-foreground font-medium active:bg-fill",
        ghost: "text-tint font-medium active:opacity-50",
        destructive: "bg-destructive text-white font-semibold active:opacity-85",
        link: "text-tint underline-offset-4 hover:underline",
      },
      size: {
        /** 50pt, the iOS large button. */
        default: "h-[52px] rounded-full px-6 type-body font-semibold",
        lg: "h-[52px] rounded-full px-6 type-body font-semibold",
        sm: "h-9 rounded-full px-4 type-subhead font-semibold",
        xs: "h-7 rounded-full px-3 type-footnote font-semibold",
        icon: "size-11 rounded-full",
        "icon-sm": "size-9 rounded-full",
        "icon-xs": "size-7 rounded-full",
        "icon-lg": "size-12 rounded-full",
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
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
