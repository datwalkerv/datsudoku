"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

/** iOS-proportioned switch (51×31); accent track when on. */
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] outline-none transition-colors duration-200",
        "data-[state=checked]:bg-primary data-[state=unchecked]:bg-fill-strong",
        "focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[27px] rounded-full bg-white shadow-[var(--shadow-thumb)] transition-transform duration-200 ease-[var(--ease-out-soft)] data-[state=checked]:translate-x-[20px] data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
