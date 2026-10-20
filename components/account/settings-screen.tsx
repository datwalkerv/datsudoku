"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  CircleAlert,
  Grid3x3,
  Hash,
  Loader2,
  Share,
  Sparkles,
  Timer,
  Trophy,
  BarChart3,
  Vibrate,
  Volume2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Group, ListRow, PageHeader, PageShell, SectionFooter, SectionLabel } from "@/components/layout/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccount } from "@/components/providers/account-provider";
import { updateSettings, useSettings, type Settings } from "@/lib/client/settings";
import { authClient } from "@/lib/auth-client";
import { useStandalone } from "@/hooks/use-standalone";

const TOGGLES: { key: keyof Settings; label: string; detail?: string; icon: LucideIcon }[] = [
  { key: "autoCleanup", label: "Auto-Clean Notes", detail: "Remove a placed number from related notes", icon: Sparkles },
  { key: "showMistakes", label: "Show Mistakes", detail: "Mark entries that don't match the solution", icon: CircleAlert },
  { key: "highlightRelated", label: "Highlight Row, Column & Box", icon: Grid3x3 },
  { key: "highlightMatches", label: "Highlight Matching Numbers", icon: Hash },
  { key: "showTimer", label: "Show Timer", icon: Timer },
  { key: "sound", label: "Sounds", icon: Volume2 },
  { key: "haptics", label: "Haptics", detail: "On supported devices", icon: Vibrate },
];

export function SettingsScreen() {
  const settings = useSettings();
  const { theme, setTheme } = useTheme();
  const standalone = useStandalone();

  return (
    <PageShell>
      <PageHeader title="Profile" backHref={null} />
      <div className="space-y-10 pb-6">
        <AccountSection />

        <section>
          <SectionLabel>Appearance</SectionLabel>
          <Segmented
            label="Theme"
            options={[
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ]}
            value={theme ?? "system"}
            onChange={setTheme}
          />
        </section>

        <section>
          <SectionLabel>Game</SectionLabel>
          <Group>
            {TOGGLES.map(({ key, label, detail, icon }) => (
              <ListRow
                key={key}
                icon={icon}
                title={label}
                detail={detail}
                trailing={
                  <Switch checked={settings[key]} onCheckedChange={(v) => updateSettings({ [key]: v })} aria-label={label} />
                }
              />
            ))}
          </Group>
        </section>

        <section>
          <SectionLabel>About</SectionLabel>
          <Group>
            {!standalone && <ListRow icon={Share} title="Add to Home Screen" href="/install" />}
            <ListRow icon={BarChart3} title="Statistics" href="/stats" />
            <ListRow icon={Trophy} title="Leaderboards" href="/leaderboard" />
          </Group>
          <SectionFooter>
            Puzzles from YouDoSudoku are verified for a unique solution before play. Expert puzzles are generated
            in-house.
          </SectionFooter>
        </section>
      </div>
    </PageShell>
  );
}

function AccountSection() {
  const router = useRouter();
  const { account, pending, refetch } = useAccount();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (pending) return null;

  if (!account || account.isAnonymous) {
    return (
      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="rounded-[20px] bg-card p-5 text-center shadow-[var(--shadow-card)]">
          <span className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-fill text-muted-foreground">
            <UserRound className="size-7" strokeWidth={1.8} />
          </span>
          <p className="type-headline">Playing as a guest</p>
          <p className="mx-auto mt-1 max-w-72 type-subhead text-muted-foreground">
            Create an account to appear on leaderboards and sync across devices. Your games and streak come with you.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button asChild>
              <Link href="/sign-up">Create Account</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/sign-in">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const value = name ?? account.name;

  const saveName = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === account.name) return;
    setSaving(true);
    const { error } = await authClient.updateUser({ name: trimmed.slice(0, 40) });
    setSaving(false);
    if (error) toast.error(error.message ?? "Couldn't update your name.");
    else {
      toast("Display name updated");
      refetch();
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    refetch();
    router.replace("/");
  };

  const deleteAccount = async () => {
    setDeleting(true);
    const { error } = await authClient.deleteUser({ password: password || undefined });
    setDeleting(false);
    if (error) {
      toast.error(error.message ?? "Couldn't delete the account.");
      return;
    }
    setDeleteOpen(false);
    refetch();
    router.replace("/");
  };

  return (
    <section>
      <SectionLabel>Account</SectionLabel>
      <Group>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary type-title2 text-primary-foreground">
            {account.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate type-title3">{account.name}</span>
            <span className="block truncate type-subhead text-muted-foreground">{account.email}</span>
          </span>
        </div>
      </Group>
      <Group className="mt-5">
        <div className="relative flex min-h-11 items-center gap-3 px-4 after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:scale-y-50 after:bg-border">
          <label htmlFor="display-name" className="type-body">
            Display Name
          </label>
          <Input
            id="display-name"
            value={value}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="h-11 flex-1 border-0 bg-transparent px-0 text-right type-body text-muted-foreground shadow-none focus-visible:text-foreground focus-visible:ring-0"
          />
          {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <ListRow title="Sign Out" tint chevron={false} onClick={signOut} />
      </Group>
      <Group className="mt-5">
        <ListRow title="Delete Account" destructive chevron={false} onClick={() => setDeleteOpen(true)} />
      </Group>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account, games, results and statistics. It can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Password (if you have one)"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 rounded-[10px] border-0 bg-fill shadow-none"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={deleting}>
              {deleting && <Loader2 className="animate-spin" />} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
