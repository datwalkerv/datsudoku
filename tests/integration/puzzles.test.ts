import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acquirePuzzle, findPuzzleBySeed } from "@/lib/puzzles/acquire";
import { collections, ensureIndexes } from "@/lib/db/collections";
import { client } from "@/lib/db/mongodb";
import { normalizeGrid } from "@/lib/sudoku/api";
import { hasUniqueSolution } from "@/lib/sudoku/solver";
import { parseGrid } from "@/lib/sudoku/board";
import { API_PUZZLE, API_SOLUTION, AMBIGUOUS_PUZZLE } from "../fixtures";
import { apiFetch, user, validApiBody } from "../helpers";

beforeAll(() => ensureIndexes());
afterAll(() => client.close());

describe("puzzle acquisition", () => {
  it("fetches, verifies and stores a YouDoSudoku puzzle before returning it", async () => {
    const fetchImpl = apiFetch({ body: validApiBody });
    const { puzzle, fallbackReason, reused } = await acquirePuzzle({ difficulty: "hard", fetchImpl });
    expect(fallbackReason).toBeNull();
    expect(reused).toBe(false);
    expect(puzzle.source).toBe("youdosudoku");
    expect(puzzle.puzzle).toBe(API_PUZZLE);
    expect(puzzle.solution).toBe(API_SOLUTION);
    expect(puzzle.metadata.solutionSource).toBe("api");
    expect(puzzle.seed).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const headers = fetchImpl.calls[0].headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-key");
    expect(JSON.parse(String(fetchImpl.calls[0].body))).toEqual({ difficulty: "hard", solution: true, array: false });

    const stored = await collections.puzzles().findOne({ _id: puzzle._id });
    expect(stored?.validationStatus).toBe("valid");
  });

  it("resolves a duplicate puzzle to the existing record and seed", async () => {
    const a = await acquirePuzzle({ difficulty: "hard", fetchImpl: apiFetch({ body: validApiBody }) });
    const b = await acquirePuzzle({ difficulty: "hard", fetchImpl: apiFetch({ body: validApiBody }) });
    expect(b.puzzle._id.equals(a.puzzle._id)).toBe(true);
    expect(b.puzzle.seed).toBe(a.puzzle.seed);
    expect(await collections.puzzles().countDocuments({ puzzle: API_PUZZLE })).toBe(1);
  });

  it("maps a seed to exactly one stored puzzle", async () => {
    const { puzzle } = await acquirePuzzle({ difficulty: "hard", fetchImpl: apiFetch({ body: validApiBody }) });
    const bySeed = await findPuzzleBySeed(puzzle.seed);
    expect(bySeed?.puzzle).toBe(puzzle.puzzle);
    expect(await findPuzzleBySeed("doesNotExist123")).toBeNull();
  });

  it("accepts the array response format", () => {
    const rows = Array.from({ length: 9 }, (_, r) => [...API_PUZZLE.slice(r * 9, r * 9 + 9)]);
    expect(normalizeGrid(rows)).toBe(API_PUZZLE);
    expect(normalizeGrid([["1", "2"]])).toBeNull();
  });

  it("solves server-side when the API solution is missing or wrong", async () => {
    const wrong = "1" + API_SOLUTION.slice(1);
    const { puzzle } = await acquirePuzzle({
      difficulty: "hard",
      fetchImpl: apiFetch({ body: { ...validApiBody, solution: wrong } }),
    });
    expect(puzzle.solution).toBe(API_SOLUTION);
  });

  it("rejects non-unique puzzles and never serves them", async () => {
    const fetchImpl = apiFetch({ body: { difficulty: "easy", puzzle: AMBIGUOUS_PUZZLE, solution: null } });
    const { puzzle, fallbackReason } = await acquirePuzzle({ difficulty: "easy", fetchImpl });
    expect(fallbackReason).toBe("external puzzles failed verification");
    expect(puzzle.source).toBe("internal");
    expect(hasUniqueSolution(parseGrid(puzzle.puzzle))).toBe(true);
    const rejected = await collections.puzzles().findOne({ puzzle: AMBIGUOUS_PUZZLE });
    expect(rejected?.validationStatus).toBe("rejected");
    expect(rejected?.metadata.rejectionReason).toBe("multiple solutions");
  });

  it("falls back to the internal generator on malformed responses", async () => {
    const { puzzle, fallbackReason } = await acquirePuzzle({
      difficulty: "medium",
      fetchImpl: apiFetch({ body: { nope: true } }),
    });
    expect(fallbackReason).toBe("malformed");
    expect(puzzle.source).toBe("internal");
    expect(puzzle.metadata.fallbackReason).toBe("malformed");
  });

  it("retries rate limits and transient failures", async () => {
    const fetchImpl = apiFetch({ status: 429, body: {} }, new TypeError("network down"), { body: validApiBody });
    const { puzzle } = await acquirePuzzle({ difficulty: "hard", fetchImpl });
    expect(fetchImpl.calls).toHaveLength(3);
    expect(puzzle.source).toBe("youdosudoku");
  });

  it("treats the API's missing-key 400 as unauthorized without retrying", async () => {
    const fetchImpl = apiFetch({ status: 400, body: { error: "Missing API key." } });
    const { fallbackReason } = await acquirePuzzle({ difficulty: "easy", fetchImpl });
    expect(fallbackReason).toBe("unauthorized");
    expect(fetchImpl.calls).toHaveLength(1);
  });

  it("times out slow responses", async () => {
    const slow = (async (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as typeof fetch;
    const { fetchExternalPuzzle } = await import("@/lib/sudoku/api");
    await expect(
      fetchExternalPuzzle("easy", { apiKey: "k", url: "https://x.test", fetchImpl: slow, timeoutMs: 20, retries: 0 }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("generates Expert internally and records the source", async () => {
    const fetchImpl = apiFetch({ body: validApiBody });
    const { puzzle } = await acquirePuzzle({ difficulty: "expert", fetchImpl });
    expect(fetchImpl.calls).toHaveLength(0);
    expect(puzzle.source).toBe("internal");
    expect(puzzle.difficulty).toBe("expert");
    expect(puzzle.metadata.logicLevel).toBe(3);
  });

  it("reuses an unplayed pool puzzle instead of calling the API", async () => {
    const u = user();
    const fetchImpl = apiFetch({ body: validApiBody });
    const { reused } = await acquirePuzzle({ difficulty: "hard", userId: u.id, fetchImpl });
    expect(reused).toBe(true);
    expect(fetchImpl.calls).toHaveLength(0);
  });

  it("never reuses reserved daily or room puzzles for Classic", async () => {
    await collections.puzzles().deleteMany({});
    await acquirePuzzle({ difficulty: "easy", usage: "daily", fetchImpl: apiFetch({ body: { nope: 1 } }) });
    const fetchImpl = apiFetch({ body: { nope: 1 } });
    const { reused } = await acquirePuzzle({ difficulty: "easy", userId: user().id, fetchImpl });
    expect(reused).toBe(false);
  });
});
