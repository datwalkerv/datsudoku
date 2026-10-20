import "server-only";
import { z } from "zod";
import type { ExternalDifficulty } from "./types";

/**
 * Client for https://www.youdosudoku.com/api.
 *
 * Verified response (POST, array:false):
 *   {"difficulty":"hard","puzzle":"<81 digits>","solution":"<81 digits>"}
 * With array:true the grids come back as 9x9 arrays of digit strings, so the
 * schema accepts both shapes defensively.
 */

export type PuzzleApiErrorKind =
  | "not_configured"
  | "unauthorized"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "malformed";

export class PuzzleApiError extends Error {
  constructor(
    readonly kind: PuzzleApiErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PuzzleApiError";
  }

  get retryable() {
    return this.kind === "rate_limited" || this.kind === "timeout" || this.kind === "unavailable";
  }
}

const cell = z.union([z.string(), z.number()]);
const gridSchema = z.union([z.string(), z.array(z.array(cell))]);

const responseSchema = z.object({
  difficulty: z.string().optional(),
  puzzle: gridSchema,
  solution: gridSchema.optional().nullable(),
});

/** Normalizes either grid shape into an 81-digit string, or null if unusable. */
export function normalizeGrid(input: z.infer<typeof gridSchema> | null | undefined): string | null {
  if (input == null) return null;
  const flat = typeof input === "string" ? input : input.flat().map(String).join("");
  const digits = flat.replace(/[.\-_]/g, "0").replace(/\s|,/g, "");
  return /^[0-9]{81}$/.test(digits) ? digits : null;
}

export interface ExternalPuzzle {
  puzzle: string;
  solution: string | null;
  reportedDifficulty: string | null;
  latencyMs: number;
}

export interface FetchOptions {
  apiKey: string | undefined;
  url: string;
  timeoutMs?: number;
  retries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchOnce(difficulty: ExternalDifficulty, opts: FetchOptions): Promise<ExternalPuzzle> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8_000);
  const started = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": opts.apiKey! },
      body: JSON.stringify({ difficulty, solution: true, array: false }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (controller.signal.aborted) throw new PuzzleApiError("timeout", "Puzzle service timed out");
    throw new PuzzleApiError("unavailable", `Puzzle service unreachable: ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 || response.status === 403) {
    throw new PuzzleApiError("unauthorized", "Puzzle service rejected the API key", response.status);
  }
  if (response.status === 429) throw new PuzzleApiError("rate_limited", "Puzzle service rate limit reached", 429);
  if (response.status >= 500) {
    throw new PuzzleApiError("unavailable", `Puzzle service error ${response.status}`, response.status);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new PuzzleApiError("malformed", "Puzzle service returned invalid JSON", response.status);
  }
  if (!response.ok) {
    const message = (body as { error?: string } | null)?.error ?? `HTTP ${response.status}`;
    // The API answers 400 {"error":"Missing API key."} for auth problems.
    const kind = /api key/i.test(message) ? "unauthorized" : "malformed";
    throw new PuzzleApiError(kind, `Puzzle service: ${message}`, response.status);
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) throw new PuzzleApiError("malformed", "Unexpected puzzle response shape");
  const puzzle = normalizeGrid(parsed.data.puzzle);
  if (!puzzle) throw new PuzzleApiError("malformed", "Puzzle is not an 81-cell grid");
  return {
    puzzle,
    solution: normalizeGrid(parsed.data.solution),
    reportedDifficulty: parsed.data.difficulty ?? null,
    latencyMs: Date.now() - started,
  };
}

/** Fetches a puzzle, retrying transient failures with jittered backoff. */
export async function fetchExternalPuzzle(
  difficulty: ExternalDifficulty,
  opts: FetchOptions,
): Promise<ExternalPuzzle> {
  if (!opts.apiKey) throw new PuzzleApiError("not_configured", "YOUDOSUDOKU_API_KEY is not set");
  const retries = opts.retries ?? 2;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fetchOnce(difficulty, opts);
    } catch (error) {
      if (!(error instanceof PuzzleApiError) || !error.retryable || attempt >= retries) throw error;
      await sleep(400 * 2 ** attempt + Math.random() * 250);
    }
  }
}
