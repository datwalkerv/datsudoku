"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, Trophy, UserRound, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/daily", label: "Daily", icon: CalendarDays },
  { href: "/multiplayer", label: "Rooms", icon: Users },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/settings", label: "Profile", icon: UserRound },
];

/** Translucent bottom navigation; content scrolls underneath it. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="material-bar fixed inset-x-0 bottom-0 z-40 shadow-[0_-0.5px_0_var(--border)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5 px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 transition-colors duration-150 active:opacity-60",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
                <span className={cn("text-[0.6875rem] leading-none", active ? "font-semibold" : "font-medium")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
