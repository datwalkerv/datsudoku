# Sudoku

A calm, Apple‑inspired Sudoku PWA: Classic play, a shared Daily Challenge and private multiplayer rooms. Built with Next.js 16 (App Router, Cache Components), MongoDB Atlas, Better Auth and Serwist. Runs on Vercel Hobby with no persistent server.

## Features

- **Classic** – Easy, Medium, Hard (YouDoSudoku) and Expert (verified internal generator). Notes, undo/redo, hints, mistake checking, a timer with pause, and automatic saving.
- **Daily Challenge** – one puzzle per UTC date for everyone, one attempt, streaks, and a server‑timed leaderboard.
- **Multiplayer** – private rooms joined by code or link. Everyone gets the same seeded puzzle; times are measured by the server. Rooms show live progress (polling), results and rematches.
- **Leaderboards** – personal bests by mode and difficulty, plus daily and room boards. Deterministic tie‑breaking and cursor pagination.
- **Accounts** – email/password and Google via Better Auth. Guests play right away as anonymous users, and their games, results and streak move to the account when they sign up or sign in.
- **PWA** – installable on iOS (Share → Add to Home Screen), standalone display, safe areas, offline play for games opened before, local‑first IndexedDB storage with server sync.

## Architecture

| Area | Where |
|---|---|
| Sudoku engine (pure TS: board, solver, generator, rater, engine, history) | `lib/sudoku/*` |
| YouDoSudoku client and puzzle acquisition (validate → verify unique → store) | `lib/sudoku/api.ts`, `lib/puzzles/*` |
| MongoDB connection, collections and indexes | `lib/db/*` |
| Game, daily, room, leaderboard and stats services | `lib/games`, `lib/daily`, `lib/multiplayer`, `lib/leaderboard`, `lib/stats` |
| Better Auth (server, client) | `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]` |
| Route handlers | `app/api/*` |
| Local‑first storage and sync | `lib/local/*`, `lib/client/sync.ts` |
| Service worker | `app/sw.ts`, `app/serwist/[path]/route.ts` |

**Integrity rules** (`lib/games/rules.ts`):
- The solution is never sent to the browser.
- Completions are verified on the server against the stored solution. The client's move log is replayed to recompute mistakes and hints.
- Only one result is stored per game, so repeated submissions return the same result.
- Daily and room times use server timestamps. Classic time is the player's active time, capped by server wall‑clock.
- Only registered, hint‑free games are ranked.

**Sync** (`lib/client/sync.ts`):
- Every change is written to IndexedDB immediately.
- Saves to the server are throttled and versioned (optimistic concurrency).
- On a version conflict, a completed server game always wins. Otherwise the copy with more play time wins, and the losing copy is kept as a snapshot.
- Saves that fail transiently are retried with backoff and sent when the device is back online.

## Local development

Requirements: Node 24+, pnpm.

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev
```

MongoDB must be a replica set, because completions and guest linking use transactions. Atlas clusters already are. For a local database, run `mongod --replSet rs0` once, then `rs.initiate()`.

Without `YOUDOSUDOKU_API_KEY`, puzzles come from the internal generator. Without the Google variables, the Google button is hidden.

## Tests

```bash
pnpm test        # unit and integration (Vitest; in-memory MongoDB replica set)
pnpm build && pnpm test:e2e   # end-to-end (Playwright: Chromium and iPhone WebKit)
pnpm typecheck && pnpm lint
```

The e2e suite starts `next start` against an in‑memory database. It makes no external calls.

## Deploying to Vercel (Hobby)

1. **MongoDB Atlas.**
   - Create a cluster (M0 is fine) and a database user.
   - Under Network Access, allow `0.0.0.0/0`. Vercel functions don't use fixed IPs.
2. **Google OAuth** (optional).
   - In Google Cloud Console, create an OAuth client of type "Web application".
   - Authorized JavaScript origin: `https://<your-domain>`.
   - Redirect URI: `https://<your-domain>/api/auth/callback/google`.
3. **Vercel.**
   - Import the repository.
   - Set these environment variables for Production (and Preview if you use it): `MONGODB_URI`, `MONGODB_DB_NAME`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your production URL), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUDOSUDOKU_API_KEY`.
4. **Deploy.**
   - Indexes are created automatically on first use.
   - The Daily Challenge is assigned on the first request of each UTC day, so no cron job is needed.
5. **iPhone.**
   - Open the site in Safari, tap Share, then Add to Home Screen, and launch it from the Home Screen.
   - Open a game, turn on Airplane Mode, and confirm the game reopens and stays playable.

Vercel Hobby is for personal, non‑commercial use. If the app becomes a commercial product, move it to a plan that permits commercial use.
