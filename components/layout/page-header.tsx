import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Minimal top bar: back link, centered title, optional trailing controls. */
export function PageHeader({
  title,
  subtitle,
  backHref = "/",
  backLabel = "Home",
  trailing,
  className,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  backHref?: string | null;
  backLabel?: string;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("safe-pt grid h-auto grid-cols-[1fr_auto_1fr] items-center gap-2 pb-2", className)}>
      <div className="flex min-w-0 items-center">
        {backHref && (
          <Link
            href={backHref}
            className="-ml-2 inline-flex h-10 items-center gap-0.5 rounded-lg pr-2 text-[15px] text-tint transition-opacity hover:opacity-70"
          >
            <ChevronLeft className="size-5" strokeWidth={2} aria-hidden />
            <span>{backLabel}</span>
          </Link>
        )}
      </div>
      <div className="min-w-0 text-center">
        {title && <h1 className="truncate text-[15px] font-semibold tracking-tight">{title}</h1>}
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center justify-end gap-1">{trailing}</div>
    </header>
  );
}

/** Centered column used by every page; respects safe areas. */
export function PageShell({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cn("safe-px safe-pb mx-auto flex min-h-dvh w-full flex-col", wide ? "max-w-3xl" : "max-w-xl", className)}>
      {children}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("px-1 pb-2 text-[13px] font-medium text-muted-foreground", className)}>{children}</h2>;
}

/** Inset grouped list, iOS settings style. */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[14px] border bg-card divide-y divide-border", className)}>{children}</div>
  );
}
