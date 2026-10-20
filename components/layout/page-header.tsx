"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * iOS navigation: a translucent bar with a back button, plus a large title in
 * the content. When the large title scrolls under the bar, the bar shows a
 * compact title and a hairline edge.
 */
export function PageHeader({
  title,
  subtitle,
  backHref = "/",
  backLabel = "Home",
  trailing,
  large = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  backHref?: string | null;
  backLabel?: string;
  trailing?: ReactNode;
  /** Large title below the bar (iOS default for top-level screens). */
  large?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(!large);

  useEffect(() => {
    if (!large || !sentinel.current) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      rootMargin: "-56px 0px 0px 0px",
    });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [large]);

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 -mx-[max(1rem,env(safe-area-inset-left))] px-[max(1rem,env(safe-area-inset-left))] pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200",
          // Transparent over the page until content scrolls beneath it.
          scrolled ? "material-bar shadow-[0_0.5px_0_var(--border)]" : "bg-transparent",
        )}
      >
        <div className="grid h-11 grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex min-w-0 items-center">
            {backHref && (
              <Link
                href={backHref}
                className="pressable -ml-2 inline-flex h-11 items-center pr-2 type-body text-tint active:opacity-50"
              >
                <ChevronLeft className="size-7 -mr-0.5" strokeWidth={2.2} aria-hidden />
                <span>{backLabel}</span>
              </Link>
            )}
          </div>
          <div
            className={cn(
              "min-w-0 text-center transition-opacity duration-200",
              large && !scrolled ? "opacity-0" : "opacity-100",
            )}
            aria-hidden={large && !scrolled}
          >
            {title && <p className="truncate type-headline">{title}</p>}
            {!large && subtitle && <p className="truncate type-caption text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center justify-end gap-1">{trailing}</div>
        </div>
      </header>
      {large && title && (
        <div className="pt-3 pb-7">
          <h1 className="type-large-title">{title}</h1>
          {subtitle && <p className="mt-1.5 type-subhead text-muted-foreground">{subtitle}</p>}
          <div ref={sentinel} aria-hidden />
        </div>
      )}
    </>
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

/** Grouped-list section header. */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("px-1 pb-3 type-title3", className)}>{children}</h2>;
}

/** Explanatory text under a grouped-list section. */
export function SectionFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("px-1 pt-3 type-footnote text-muted-foreground", className)}>{children}</p>;
}

/** Inset grouped list (iOS Settings style). */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-[24px] bg-card py-1.5", className)}>{children}</div>;
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * One row of a grouped list: optional line icon, title, detail and trailing
 * content. The separator is inset to the text.
 */
export function ListRow({
  icon: IconCmp,
  title,
  detail,
  value,
  href,
  onClick,
  trailing,
  chevron = Boolean(href || onClick),
  destructive,
  tint,
  disabled,
}: {
  icon?: Icon;
  title: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  href?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  tint?: boolean;
  disabled?: boolean;
}) {
  const body = (
    <>
      {IconCmp && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill">
          <IconCmp className="size-[19px] text-foreground" strokeWidth={1.9} aria-hidden />
        </span>
      )}
      <span
        className={cn(
          "relative flex min-h-16 min-w-0 flex-1 items-center gap-3 self-stretch py-2.5 pr-5",
        )}
      >
        <span className="min-w-0 flex-1 text-left">
          <span className={cn("block type-headline", destructive && "text-destructive", tint && "text-tint")}>{title}</span>
          {detail && <span className="line-clamp-2 type-footnote text-muted-foreground">{detail}</span>}
        </span>
        {value !== undefined && <span className="shrink-0 type-body text-muted-foreground tabular-nums">{value}</span>}
        {trailing}
        {chevron && <ChevronRight className="size-4 shrink-0 text-label-tertiary" strokeWidth={2} aria-hidden />}
      </span>
    </>
  );
  const cls = cn(
    "group/row flex w-full items-center gap-3.5 pl-4 transition-colors duration-100",
    (href || onClick) && "active:bg-fill disabled:opacity-40",
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} disabled={disabled}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Plain, centered empty state (no dashed placeholder boxes). */
export function EmptyState({ icon: IconCmp, title, children }: { icon?: Icon; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[24px] bg-card px-6 py-10 text-center">
      {IconCmp && (
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-fill">
          <IconCmp className="size-5 text-muted-foreground" strokeWidth={1.8} aria-hidden />
        </span>
      )}
      {title && <p className="type-headline">{title}</p>}
      {children && <p className="max-w-72 type-subhead text-muted-foreground">{children}</p>}
    </div>
  );
}
