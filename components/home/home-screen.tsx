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
  Loader2,
  Play,
  Settings,
  Share,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group, ListRow, PageShell, SectionFooter, SectionLabel } from "@/components/layout/page-header";
import { Segmented } from "@/components/ui/segmented";
import { MiniBoard } from "./mini-board";
import { useAccount } from "@/components/providers/account-provider";
import { useOnline } from "@/hooks/use-online";
import { useStandalone } from "@/hooks/use-standalone";
import { getLocalGame, latestUnfinished, type LocalGame } from "@/lib/local/db";
import { adoptServerGame, startClassic } from "@/lib/client/start";
import { api } from "@/lib/client/api";
import type { DailyStatus } from "@/lib/daily/types";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/sudoku/types";
import { formatDateKey, formatDuration } from "@/lib/format";

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
  const { account, pending, ensureAccount } = useAccount();
  const [difficulty, setDifficulty] = useDifficulty();
  const [resume, setResume] = useState<LocalGame | null | undefined>(undefined);
  const [daily, setDaily] = useState<DailyStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await latestUnfinished(account?.id ?? null).catch(() => undefined);
      if (local || !account || !online) return local ?? null;
      // Nothing on this device (another device, or guest games just moved to
      // a new account): continue the newest unfinished game from the server.
      const { games } = await api.listGames("active");
      if (!games[0]) return null;
      const { game } = await api.getGame(games[0].id);
      return (await getLocalGame(await adoptServerGame(game, account.id))) ?? null;
    })()
      .then((g) => !cancelled && setResume(g))
      .catch(() => !cancelled && setResume(null));
    return () => {
      cancelled = true;
    };
  }, [account, online]);

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
      const owner = await ensureAccount();
      const started = await startClassic(difficulty, owner?.id ?? null);
      if (started.offline) toast("You're offline — this game stays on this device.");
      else if (started.fallbackReason) toast("Puzzle service unavailable — using a verified generated puzzle.");
      router.push(`/play?id=${encodeURIComponent(started.id)}`);
    } catch {
      toast.error("Couldn't start a game. Please try again.");
      setBusy(false);
    }
  };

  const signedIn = account && !account.isAnonymous;
  const streak = daily?.streak ?? 0;

  return (
    <PageShell className="pb-6">
      <header className="safe-pt flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3">
        <Link
          href={signedIn ? "/settings" : "/sign-in"}
          aria-label={signedIn ? "Profile" : "Sign in"}
          className="pressable flex size-10 shrink-0 items-center justify-center rounded-full bg-primary type-headline text-primary-foreground"
        >
          {signedIn ? account.name.trim().charAt(0).toUpperCase() : <UserRound className="size-5" strokeWidth={2} />}
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          {signedIn ? (
            <p className="truncate type-headline">Welcome back, {account.name.split(" ")[0]}</p>
          ) : (
            <p className="type-headline">Sudoku</p>
          )}
          <p className="truncate type-caption text-muted-foreground">
            {daily ? formatDateKey(daily.dateKey, { weekday: "long", month: "long", day: "numeric" }) : "Guest"}
          </p>
        </div>
        <Link
          href="/stats"
          aria-label="Statistics"
          className="pressable flex size-10 items-center justify-center rounded-full bg-fill"
        >
          <BarChart3 className="size-[19px]" strokeWidth={2} />
        </Link>
      </header>

      <section className="pt-10 pb-9 text-center" aria-label="Daily streak">
        <p className="type-subhead font-medium text-muted-foreground">Daily streak</p>
        <p className="mt-2 type-display">
          {streak}
          <span className="ml-2 align-middle text-2xl font-semibold tracking-tight text-muted-foreground">
            {streak === 1 ? "day" : "days"}
          </span>
        </p>
        <Link
          href="/daily"
          className="pressable mt-5 inline-flex h-9 items-center gap-1.5 rounded-full bg-fill pr-3 pl-4 type-subhead font-semibold"
        >
          {daily?.result ? "Today's puzzle solved" : "Play today's puzzle"}
          <ChevronRight className="size-4 text-muted-foreground" strokeWidth={2.4} />
        </Link>
      </section>

      <nav aria-label="Quick actions" className="grid grid-cols-4 gap-2 pb-9">
        <Action href="/daily" icon={CalendarDays} label="Daily" />
        <Action href="/multiplayer" icon={Users} label="Rooms" />
        <Action href="/leaderboard" icon={Trophy} label="Ranks" />
        <Action href="/stats" icon={BarChart3} label="Stats" />
      </nav>

      <div className="flex flex-col gap-8">
        {!online && (
          <div className="flex items-start gap-3 rounded-[24px] bg-card p-5">
            <CloudOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <p className="type-subhead text-muted-foreground">
              You&apos;re offline. Saved games and new practice games still work. Sign-in, leaderboards, rooms and the
              Daily Challenge need a connection.
            </p>
          </div>
        )}

        {resume && (
          <Link
            href={`/play?id=${encodeURIComponent(resume.id)}`}
            className="pressable animate-fade-up flex items-center gap-4 rounded-[24px] bg-card p-4"
          >
            <MiniBoard givens={resume.givens} values={resume.state.values} className="w-[76px] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="type-caption font-medium text-muted-foreground">Continue</p>
              <p className="mt-0.5 type-headline">
                {resume.mode === "daily" ? "Daily Challenge" : resume.mode === "room" ? `Room ${resume.roomCode}` : "Classic"} ·{" "}
                {DIFFICULTY_LABEL[resume.difficulty]}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fill">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progressOf(resume)}%` }} />
                </div>
                <span className="type-caption font-medium text-muted-foreground tabular-nums">
                  {formatDuration(resume.state.elapsedMs)}
                </span>
              </div>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Play className="size-4 translate-x-px fill-current" />
            </span>
          </Link>
        )}

        <section aria-labelledby="new-label">
          <SectionLabel>
            <span id="new-label">New game</span>
          </SectionLabel>
          <div className="space-y-4 rounded-[24px] bg-card p-4">
            <Segmented
              label="Difficulty"
              options={DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[d]] as const)}
              value={difficulty}
              onChange={setDifficulty}
            />
            <Button onClick={newGame} disabled={busy} className="w-full">
              {busy && <Loader2 className="animate-spin" />}
              Start {DIFFICULTY_LABEL[difficulty]} game
            </Button>
          </div>
          {difficulty === "expert" && <SectionFooter>Expert puzzles are generated and verified in-house.</SectionFooter>}
        </section>

        <section aria-labelledby="more-label">
          <SectionLabel>
            <span id="more-label">More</span>
          </SectionLabel>
          <Group>
            <ListRow icon={CalendarDays} title="Daily Challenge" detail={dailyDetail(daily, online)} href="/daily" />
            <ListRow icon={Users} title="Multiplayer" detail="Private rooms, same puzzle" href="/multiplayer" />
            <ListRow icon={Settings} title="Settings" detail="Theme, notes and feedback" href="/settings" />
            {!standalone && <ListRow icon={Share} title="Add to Home Screen" detail="Full screen, works offline" href="/install" />}
          </Group>
        </section>
      </div>
    </PageShell>
  );
}

/** A round quick-action button with its label underneath. */
function Action({ href, icon: Icon, label }: { href: string; icon: typeof Trophy; label: string }) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-2">
      <span className="flex size-[52px] items-center justify-center rounded-full bg-card transition-transform duration-150 group-active:scale-90">
        <Icon className="size-[22px]" strokeWidth={1.9} aria-hidden />
      </span>
      <span className="type-caption font-medium">{label}</span>
    </Link>
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
