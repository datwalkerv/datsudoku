import { expect, type Page } from "@playwright/test";
import { parseGrid } from "../../lib/sudoku/board";
import { solve } from "../../lib/sudoku/solver";

/** Opens Home, waits for the guest session, and starts a Classic game. */
export async function startClassic(page: Page, difficulty = "Easy") {
  await page.goto("/");
  await waitForSession(page);
  await page.getByRole("radio", { name: difficulty }).click();
  await page.getByRole("button", { name: `Start ${difficulty} game` }).click();
  await page.waitForURL(/\/play\?id=/);
  await expect(page.getByRole("grid", { name: "Sudoku board" })).toBeVisible();
  return new URL(page.url()).searchParams.get("id")!;
}

export async function waitForSession(page: Page) {
  await expect
    .poll(async () => (await page.request.get("/api/auth/get-session")).json(), { timeout: 15_000 })
    .not.toBeNull();
}

/** Reads the givens from the board's accessible labels. */
export async function readGivens(page: Page): Promise<string> {
  await expect(page.locator("[data-cell]")).toHaveCount(81);
  const labels = await page.locator("[data-cell]").evaluateAll((cells) => cells.map((c) => c.getAttribute("aria-label") ?? ""));
  return labels.map((l) => (l.includes("given") ? /, (\d), given/.exec(l)![1] : "0")).join("");
}

export function solutionFor(givens: string): number[] {
  return solve(parseGrid(givens))!;
}

/** Types every missing value with the keyboard. */
export async function solveOnBoard(page: Page, givens: string, skip = 0) {
  const solution = solutionFor(givens);
  const empty = [...givens].map((c, i) => (c === "0" ? i : -1)).filter((i) => i >= 0);
  for (const i of empty.slice(0, empty.length - skip)) {
    await page.locator(`[data-cell="${i}"]`).click();
    await page.keyboard.press(String(solution[i]));
  }
  return { solution, empty };
}
