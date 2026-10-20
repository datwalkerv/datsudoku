<div align="center">

<img src="./app/icon.svg" width="10%" alt="datsudoku" style="border-radius: 16px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);" />

# datsudoku

**Nine by nine. One answer.**

A fast, beautiful Sudoku you can play anywhere, race friends on, and install on your iPhone, even offline.

</div>

## ✨ Key Features

- **🧩 Classic Play**: Easy, Medium and Hard puzzles from [YouDoSudoku](https://youdosudoku.com), plus Expert puzzles generated in-house. Every puzzle is checked for exactly one solution before you see it.
- **📅 Daily Challenge**: One shared puzzle for everyone each UTC day. You get one attempt, a streak to keep alive, and a daily leaderboard.
- **👥 Private Rooms**: Create a room and share its code or link. Everyone solves the exact same seeded puzzle, live progress shows up as friends play, and the host can start a rematch with a fresh puzzle.
- **✏️ Pencil Notes**: Tap Notes and a second row of numbers appears. The blue row adds notes, the normal row places numbers. Placed numbers clean up related notes automatically.
- **↩️ Undo, Hints & Mistakes**: Unlimited undo and redo, hints that fix a wrong entry first, mistake tracking and a pausable timer.
- **🏆 Leaderboards**: Personal bests by mode and difficulty, daily rankings and room standings, with fair tie-breaking and paging.
- **🙋 Play Instantly**: No sign-up needed to start. Create an account later and your games, results and streak come with you.
- **📱 Installs Like an App**: Add it to your iPhone Home Screen for a full-screen app with safe-area support. Games you've opened keep working offline and sync when you're back.
- **🌗 Premium UI**: Bold type, flat 24 px cards, a single blue accent, and a soft glow on true black. Light, dark or system theme.


## 🛠️ Technology Stack

- **Framework**: [Next.js 16 (App Router, Cache Components)](https://nextjs.org/)
- **Runtime & View Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components
- **Motion**: [Motion](https://motion.dev/) springs
- **Type Safety**: [TypeScript](https://www.typescriptlang.org/) and [Zod](https://zod.dev/)
- **Authentication**: [Better Auth](https://www.better-auth.com/) (email & password, optional Google, anonymous guests)
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas)
- **Puzzles**: [YouDoSudoku API](https://youdosudoku.com) and a seeded in-house generator and solver
- **Offline**: [Serwist](https://serwist.pages.dev/) service worker and IndexedDB via [idb](https://github.com/jakearchibald/idb)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Fonts**: [Inter Tight](https://fonts.google.com/specimen/Inter+Tight), self-hosted
- **Testing**: [Vitest](https://vitest.dev/) and [Playwright](https://playwright.dev/)
- **Hosting**: [Vercel](https://vercel.com/)

## ⚖️ Fair Play & Privacy

### Server-Verified Results
- The stored solution is never sent to the browser. The server checks every finished board against it.
- The server replays your move history to count mistakes and hints itself. A move list that doesn't match the board isn't ranked.
- Ranked times use the server's clock, from the moment a game is created until the server verifies it. Pausing hides the board but doesn't stop that clock.
- Each game records exactly one result, so sending the same completion again returns the original result.
- Only registered players with hint-free games are ranked. Times faster than one second per empty cell are flagged.
- Ties go to fewer mistakes, then to whoever finished first.

### Puzzles
- Every external puzzle is validated, normalized and checked for a unique solution before it's stored. Puzzles that fail are recorded as rejected and never served.
- Each puzzle is saved to MongoDB before anyone plays it. A room's seed always maps to the same stored puzzle.
- The first request each UTC day assigns the Daily puzzle. A unique index makes simultaneous first requests agree on one puzzle, so no cron job is needed.
- If the puzzle service is down, a verified in-house puzzle is used instead.

### Offline & Sync
- Every move is saved on your device immediately, in IndexedDB.
- Changes reach the server a few seconds later and are retried with backoff if the connection drops.
- Each save carries a version number, so an older copy can never overwrite a newer one. On a conflict, a completed game always wins. Otherwise the copy with more play time wins, and the other is kept as a snapshot.
- The service worker caches app shells and static files only. Private API responses are never cached.

### Identity & Access
- Guests get a real anonymous account the moment they start playing. Browsing alone creates nothing.
- When a guest signs up or signs in, their games, results, rooms and streak move to the account. The move uses the server's own session data, so nobody can claim someone else's games.
- Every read and write is checked against the signed-in user. Someone else's game answers `404`, as if it didn't exist.
- Room codes are random, drawn with `crypto.randomInt`. Rooms expire after 7 days without activity.
- Sign-in attempts are rate-limited, with counters stored in MongoDB so the limits hold across serverless instances.

### Privacy Policy
- datsudoku collects **nothing beyond what the game needs**. No analytics, no ads and no tracking scripts. Fonts are self-hosted.
- The only data stored is:
  - Your account (email and display name), if you create one
  - Your games, results, personal bests and streak
  - Room membership and display names
- Deleting your account removes all of it.

<br>

**Made with love for puzzle lovers. 💙**  
*Nine by nine. One answer.*
