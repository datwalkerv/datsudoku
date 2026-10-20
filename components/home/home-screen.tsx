"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  CloudOff,
  Flame,
  Grid3x3,
  Loader2,
  Settings,
  Share,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group, PageShell, SectionLabel } from "@/components/layout/page-header";
import { MiniBoard } from "./mini-board";
import { useAccount } from "@/components/providers/account-provider";
import { useOnline } from "@/hooks/use-online";
import { useStandalone } from "@/hooks/use-standalone";
import { latestUnfinished, type LocalGame } from "@/lib/local/db";
import { startClassic } from "@/lib/client/start";
import { api } from "@/lib/client/api";
import type { DailyStatus } from "@/lib/daily/types";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/sudoku/types";
import { formatDateKey, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const DIFFICULTY_KEY = "sudoku:difficulty";
const difficultyListeners = new Set<() => void>();

function readDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFFICULTY_KEY);
    return (DIFFICULTIES as readonly string[]).includes(v ?? "") ? (v as Difficulty) : "medium";
  } catch {
    return "medium";
  }
}

function useDifficulty(): [Difficulty, (d: Difficulty) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      difficultyListeners.add(cb);
      return () => difficultyListeners.delete(cb);
    },
    readDifficulty,
    () => "medium" as Difficulty,
  );
  const set = (d: Difficulty) => {
    try {
      localStorage.setItem(DIFFICULTY_KEY, d);
    } catch {}
    difficultyListeners.forEach((l) => l());
  };
  return [value, set];
}

export function HomeScreen() {
  const router = useRouter();
  const online = useOnline();
  const standalone = useStandalone();
  const { account, pending } = useAccount();
  const [difficulty, setDifficulty] = useDifficulty();
  const [resume, setResume] = useState<LocalGame | null | undefined>(undefined);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    latestUnfinished(account?.id ?? null)
      .then((g) => !cancelled && setResume(g ?? null))
      .catch(() => !cancelled && setResume(null));
    return () => {
      cancelled = true;
    };
  }, [account?.id]);

  useEffect(() => {
    if (!online || pending) return;
    let cancelled = false;
    api
      .daily()
      .then((d) => !cancelled && setDaily(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [online, pending, account?.id]);

  const newGame = async () => {
    setBusy(true);
    try {
      const started = await startClassic(difficulty, account?.id ?? null);
      if (started.offline) toast("You're offline — this game stays on this device.");
      else if (started.fallbackReason) toast("Puzzle service unavailable — using a verified generated puzzle.");
      router.push(`/play?id=${encodeURIComponent(started.id)}`);
    } catch {
      toast.error("Couldn't start a game. Please try again.");
      setBusy(false);
    }
  };

  return (
    <PageShell className="gap-8 pb-10">
      <header className="safe-pt flex items-center justify-between pt-4">
        <div>
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Sudoku</h1>
          <p className="text-sm text-muted-foreground">
            {account && !account.isAnonymous ? `Welcome back, ${account.name.split(" ")[0]}` : "Calm, precise, distraction‑free."}
          </p>
        </div>
        <Link
          href={account && !account.isAnonymous ? "/settings" : "/sign-in"}
          className="flex h-10 items-center gap-1.5 rounded-full border bg-card px-3 text-sm transition-colors hover:bg-secondary"
          aria-label={account && !account.isAnonymous ? "Account and settings" : "Sign in"}
        >
          <UserRound className="size-4 text-muted-foreground" />
          <span className="max-w-28 truncate">{account && !account.isAnonymous ? account.name : "Sign in"}</span>
        </Link>
      </header>

      {!online && (
        <p className="-mb-4 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-[13px] text-muted-foreground">
          <CloudOff className="size-4 shrink-0" /> Offline. Saved games and new practice games still work; sign-in,
          leaderboards, rooms and the Daily Challenge need a connection.
        </p>
      )}

      {resume && (
        <section aria-labelledby="continue-label" className="animate-fade-up">
          <SectionLabel>
            <span id="continue-label">Continue</span>
          </SectionLabel>
          <Link
            href={`/play?id=${encodeURIComponent(resume.id)}`}
            className="group flex items-center gap-4 rounded-[14px] border bg-card p-3 pr-4 transition-colors hover:bg-secondary/40"
          >
            <MiniBoard givens={resume.givens} values={resume.state.values} className="w-20 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {resume.mode === "daily" ? "Daily Challenge" : resume.mode === "room" ? `Room ${resume.roomCode}` : "Classic"}
              </p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {DIFFICULTY_LABEL[resume.difficulty]} · {formatDuration(resume.state.elapsedMs)} · {progressOf(resume)}%
              </p>
            </div>
            <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </section>
      )}

      <section aria-labelledby="new-label">
        <SectionLabel>
          <span id="new-label">New game</span>
        </SectionLabel>
        <div className="rounded-[14px] border bg-card p-3">
          <div role="radiogroup" aria-label="Difficulty" className="grid grid-cols-4 gap-1 rounded-[10px] bg-secondary p-1">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={difficulty === d}
                onClick={() => setDifficulty(d)}
                className={cn(
                  "h-9 rounded-[8px] text-sm transition-[background-color,color,box-shadow] duration-150",
                  difficulty === d
                    ? "bg-card font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {DIFFICULTY_LABEL[d]}
              </button>
            ))}
          </div>
          <Button onClick={newGame} disabled={busy} className="mt-3 h-12 w-full rounded-[10px] text-[15px]">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Start {DIFFICULTY_LABEL[difficulty]} game
          </Button>
          {difficulty === "expert" && (
            <p className="mt-2 text-center text-xs text-muted-foreground">Expert puzzles are generated and verified in-house.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="modes-label">
        <SectionLabel>
          <span id="modes-label">Modes</span>
        </SectionLabel>
        <Group>
          <Row icon={Grid3x3} title="Classic" detail="Play at your own pace" onClick={newGame} />
          <Row
            icon={CalendarDays}
            title="Daily Challenge"
            detail={dailyDetail(daily, online)}
            href="/daily"
            trailing={
              daily && daily.streak > 0 ? (
                <span className="flex items-center gap-0.5 text-xs font-medium tabular-nums text-foreground/80" aria-label={`${daily.streak} day streak`}>
                  <Flame className="size-3.5 text-orange-500" /> {daily.streak}
                </span>
              ) : daily?.result ? (
                <span className="text-xs font-medium text-tint">Done</span>
              ) : null
            }
          />
          <Row icon={Users} title="Multiplayer" detail="Private rooms, same puzzle" href="/multiplayer" />
        </Group>
      </section>

      <section aria-labelledby="more-label">
        <SectionLabel>
          <span id="more-label">More</span>
        </SectionLabel>
        <Group>
          <Row icon={Trophy} title="Leaderboards" href="/leaderboard" />
          <Row icon={BarChart3} title="Statistics" href="/stats" />
          <Row icon={Settings} title="Settings" href="/settings" />
          {!standalone && <Row icon={Share} title="Add to Home Screen" detail="Play full screen, even offline" href="/install" />}
        </Group>
      </section>
    </PageShell>
  );
}

function progressOf(game: LocalGame) {
  const empty = [...game.givens].filter((c) => c === "0").length;
  const filled = game.state.values.filter((v, i) => v !== 0 && game.givens[i] === "0").length;
  return Math.round((filled / Math.max(1, empty)) * 100);
}

function dailyDetail(daily: DailyStatus | null, online: boolean) {
  if (!online) return "Needs a connection";
  if (!daily) return "One shared puzzle each day";
  const date = formatDateKey(daily.dateKey, { month: "short", day: "numeric" });
  if (daily.result) return `${date} · solved in ${formatDuration(daily.result.timeMs)}`;
  if (daily.game) return `${date} · in progress`;
  return `${date} · ${DIFFICULTY_LABEL[daily.difficulty]} · ${daily.participants} solved`;
}

function Row({
  icon: Icon,
  title,
  detail,
  href,
  onClick,
  trailing,
  busy,
}: {
  icon: typeof Trophy;
  title: string;
  detail?: string;
  href?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  busy?: boolean;
}) {
  const inner = (
    <>
      <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-foreground/80">
        <Icon className="size-[18px]" strokeWidth={1.75} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px]">{title}</span>
        {detail && <span className="block truncate text-[13px] text-muted-foreground">{detail}</span>}
      </span>
      {trailing}
      {busy ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <ChevronRight className="size-4 text-muted-foreground/70" />
      )}
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-3 py-2 transition-colors hover:bg-secondary/50 active:bg-secondary";
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} disabled={busy}>
      {inner}
    </button>
  );
}

