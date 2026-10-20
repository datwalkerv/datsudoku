import { expect, test } from "@playwright/test";
import { readGivens, solutionFor, solveOnBoard, startClassic, waitForApp } from "./helpers";

test.describe("guest play", () => {
  test("starts immediately, saves locally and to the server, and resumes", async ({ page }) => {
    const id = await startClassic(page);
    const givens = await readGivens(page);
    const solution = solutionFor(givens);
    const cell = givens.indexOf("0");

    await page.locator(`[data-cell="${cell}"]`).click();
    await page.keyboard.press(String(solution[cell]));
    await page.keyboard.press("n"); // notes mode
    const next = givens.indexOf("0", cell + 1);
    await page.locator(`[data-cell="${next}"]`).click();
    await page.keyboard.press("1");
    await page.keyboard.press("2");
    await expect(page.locator(`[data-cell="${next}"]`)).toHaveAttribute("aria-label", /notes 1 2/);

    // Undo/redo of the note.
    await page.keyboard.press("ControlOrMeta+z");
    await expect(page.locator(`[data-cell="${next}"]`)).toHaveAttribute("aria-label", /notes 1$/);
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(page.locator(`[data-cell="${next}"]`)).toHaveAttribute("aria-label", /notes 1 2/);

    // Server receives the debounced save.
    await expect
      .poll(async () => (await (await page.request.get(`/api/games/${id}`)).json()).game.board[cell], { timeout: 15_000 })
      .toBe(String(solution[cell]));

    await page.reload();
    await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute("aria-label", new RegExp(`, ${solution[cell]}$`));
    await expect(page.locator(`[data-cell="${next}"]`)).toHaveAttribute("aria-label", /notes 1 2/);

    // Home offers to continue the game.
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Classic/ }).first()).toHaveAttribute("href", `/play?id=${id}`);
  });

  test("completes a game with a server-verified result and rejects duplicates", async ({ page }) => {
    const id = await startClassic(page);
    const givens = await readGivens(page);
    await solveOnBoard(page, givens);
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Solved")).toBeVisible();
    await expect(dialog.getByText("Verified by server")).toBeVisible({ timeout: 15_000 });

    const game = (await (await page.request.get(`/api/games/${id}`)).json()).game;
    expect(game.status).toBe("completed");
    // A replayed completion returns the same result instead of a second one.
    const replay = await page.request.post(`/api/games/${id}/complete`, {
      data: { board: game.board, moves: game.moves, elapsedSeconds: 1 },
    });
    expect((await replay.json()).result.id).toBe(game.result.id);
    // Guests are verified but not ranked.
    expect(game.result.ranked).toBe(false);
  });
});

test.describe("accounts", () => {
  test("browsing alone does not create an account", async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
    expect(await (await page.request.get("/api/auth/get-session")).json()).toBeNull();
  });

  test("registers, signs out and signs back in, keeping guest games", async ({ page }) => {
    const id = await startClassic(page);
    const email = `e2e-${Date.now()}@example.test`;
    await page.goto("/sign-up");
    await expect(page.getByText("Your guest games, results and streak will move to this account.")).toBeVisible();
    await page.getByLabel("Display name").fill("Ada");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("correct horse battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("/");
    await expect(page.getByText("Welcome back, Ada")).toBeVisible();
    // The moved game is still offered under the new account.
    await expect(page.getByRole("link", { name: /Classic/ }).first()).toHaveAttribute("href", `/play?id=${id}`);

    // The guest game now belongs to the account.
    expect((await page.request.get(`/api/games/${id}`)).status()).toBe(200);

    await page.goto("/settings");
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("/");
    expect([401, 404]).toContain((await page.request.get(`/api/games/${id}`)).status());

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrong password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByLabel("Password").fill("correct horse battery");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/");
    expect((await page.request.get(`/api/games/${id}`)).status()).toBe(200);
  });

  test("Google sign-in redirects to Google with the configured client and callback", async ({ page }) => {
    await page.goto("/sign-in");
    await waitForApp(page);
    const google = page.waitForRequest((r) => r.url().startsWith("https://accounts.google.com/"));
    await page.route("https://accounts.google.com/**", (route) => route.abort());
    await page.getByRole("button", { name: "Continue with Google" }).click();
    const url = new URL((await google).url());
    expect(url.searchParams.get("client_id")).toBe("e2e-google-client-id.apps.googleusercontent.com");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3100/api/auth/callback/google");
  });

  test("private games are not readable by other users", async ({ page, browser }) => {
    const id = await startClassic(page);
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await startClassic(otherPage); // a second signed-in guest
    expect((await otherPage.request.get(`/api/games/${id}`)).status()).toBe(404);
    const save = await otherPage.request.put(`/api/games/${id}`, {
      data: { baseVersion: 0, board: "0".repeat(81), notes: Array(81).fill(0), moves: [], mistakes: 0, hintsUsed: 0, elapsedSeconds: 1 },
    });
    expect(save.status()).toBe(404);
    await other.close();
  });
});

test.describe("daily challenge", () => {
  test("gives everyone the same puzzle and records one verified result", async ({ page, browser }) => {
    await page.goto("/daily");
    await waitForApp(page);
    await page.getByRole("button", { name: /Play today's puzzle/i }).click();
    await page.waitForURL(/\/play\?id=/);
    const givens = await readGivens(page);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await otherPage.goto("/daily");
    await waitForApp(otherPage);
    await otherPage.getByRole("button", { name: /Play today's puzzle/i }).click();
    await otherPage.waitForURL(/\/play\?id=/);
    expect(await readGivens(otherPage)).toBe(givens);
    await other.close();

    await solveOnBoard(page, givens);
    await expect(page.getByRole("dialog").getByText("Verified by server")).toBeVisible({ timeout: 15_000 });
    await page.goto("/daily");
    await expect(page.getByText(/Ranked on today's leaderboard|Sign in to appear|could not be verified/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Play today's puzzle/i })).toHaveCount(0);
  });
});

test.describe("multiplayer", () => {
  test("players joining by link get the same seeded puzzle and see each other", async ({ page, browser }) => {
    await page.goto("/multiplayer");
    await waitForApp(page);
    await page.getByRole("radio", { name: "Easy" }).click();
    await page.getByRole("button", { name: "Create room" }).click();
    await page.waitForURL(/\/multiplayer\/[0-9A-Z]{6}$/);
    const roomUrl = page.url();
    await page.getByRole("button", { name: /Start puzzle|Continue puzzle/i }).click();
    await page.waitForURL(/\/play\?id=/);
    const hostGivens = await readGivens(page);

    const guestCtx = await browser.newContext();
    const guest = await guestCtx.newPage();
    await guest.goto(roomUrl);
    await waitForApp(guest);
    await guest.getByRole("button", { name: "Join and play" }).click();
    await guest.waitForURL(/\/play\?id=/);
    expect(await readGivens(guest)).toBe(hostGivens);

    await solveOnBoard(guest, hostGivens);
    await expect(guest.getByRole("dialog").getByText("Verified by server")).toBeVisible({ timeout: 15_000 });

    await page.goto(roomUrl);
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(page.locator("ol li")).toHaveCount(1, { timeout: 15_000 });
    await expect(page.getByRole("button", { name: /rematch/i })).toBeVisible();
    await guestCtx.close();
  });
});

test.describe("offline", () => {
  test("a previously opened game stays playable offline", async ({ page, context }) => {
    const id = await startClassic(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // Make sure the service worker controls the page and has cached the shell.
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    const givens = await readGivens(page);
    const cell = givens.indexOf("0");
    const value = solutionFor(givens)[cell];
    await context.setOffline(true);
    // Reopened games resume paused.
    const timer = page.getByRole("button", { name: /^(Pause|Resume) timer$/ });
    await expect(timer).toBeEnabled();
    if ((await timer.getAttribute("aria-label")) === "Resume timer") await timer.click();
    await expect(timer).toHaveAttribute("aria-label", "Pause timer");
    await page.locator(`[data-cell="${cell}"]`).click();
    await page.keyboard.press(String(value));
    await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute("aria-label", new RegExp(`, ${value}$`));

    await page.reload();
    await expect(page.getByRole("grid", { name: "Sudoku board" })).toBeVisible();
    await expect(page.locator(`[data-cell="${cell}"]`)).toHaveAttribute("aria-label", new RegExp(`, ${value}$`));

    // Back online, the queued change reaches the server.
    await context.setOffline(false);
    await expect
      .poll(async () => (await (await page.request.get(`/api/games/${id}`)).json()).game.board[cell], { timeout: 20_000 })
      .toBe(String(value));
  });
});
