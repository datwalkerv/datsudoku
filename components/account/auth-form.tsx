"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PageHeader, PageShell } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { useAccount } from "@/components/providers/account-provider";
import { useOnline } from "@/hooks/use-online";

/**
 * Sign-in and registration. Signing in from a guest session moves the guest's
 * games to the account (Better Auth's anonymous plugin calls onLinkAccount).
 */
export function AuthForm({ mode, googleEnabled }: { mode: "sign-in" | "sign-up"; googleEnabled: boolean }) {
  const router = useRouter();
  const online = useOnline();
  const { account, refetch } = useAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"email" | "google" | null>(null);
  const isSignUp = mode === "sign-up";
  const hasGuestProgress = account?.isAnonymous;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("email");
    const { error: err } = isSignUp
      ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
      : await authClient.signIn.email({ email: email.trim(), password });
    if (err) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setBusy(null);
      return;
    }
    refetch();
    router.replace("/");
  };

  const google = async () => {
    setBusy("google");
    const { error: err } = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
    if (err) {
      setError(err.message ?? "Google sign-in is unavailable.");
      setBusy(null);
    }
  };

  return (
    <PageShell>
      <PageHeader title={isSignUp ? "Create account" : "Sign in"} />
      <div className="mx-auto w-full max-w-sm space-y-6 pt-6">
        {hasGuestProgress && (
          <p className="rounded-xl bg-accent px-3 py-2 text-[13px] text-accent-foreground">
            Your guest games, results and streak will move to this account.
          </p>
        )}
        {!online && (
          <p className="rounded-xl bg-secondary px-3 py-2 text-[13px] text-muted-foreground">
            You&apos;re offline. Signing in needs a connection.
          </p>
        )}

        {googleEnabled && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={google}
              disabled={busy !== null || !online}
              className="h-12 w-full rounded-[12px] bg-card text-[15px]"
            >
              {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark />}
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-4">
          {isSignUp && (
            <Field label="Display name" id="name">
              <Input id="name" required maxLength={40} autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} className="h-11 bg-card" />
            </Field>
          )}
          <Field label="Email" id="email">
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 bg-card" />
          </Field>
          <Field label="Password" id="password">
            <Input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-card"
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy !== null || !online} className="h-12 w-full rounded-[12px] text-[15px]">
            {busy === "email" && <Loader2 className="size-4 animate-spin" />}
            {isSignUp ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isSignUp ? "Already have an account? " : "New here? "}
          <Link href={isSignUp ? "/sign-in" : "/sign-up"} className="text-tint hover:underline">
            {isSignUp ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </PageShell>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h6a5.1 5.1 0 0 1-2.2 3.4v2.8h3.6c2.1-1.9 3.2-4.8 3.2-8.2Z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.6-2.8c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.7 14c-.2-.7-.4-1.3-.4-2s.1-1.4.4-2V7.1H2A11 11 0 0 0 1 12c0 1.8.4 3.5 1.2 4.9L5.7 14Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2 7.1L5.7 10c.9-2.7 3.4-4.6 6.3-4.6Z" />
    </svg>
  );
}
