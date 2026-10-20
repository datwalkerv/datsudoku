import { ObjectId } from "mongodb";
import type { SessionUser } from "@/lib/auth";
import { API_PUZZLE, API_SOLUTION } from "./fixtures";

export function user(overrides: Partial<SessionUser> = {}): SessionUser {
  const id = new ObjectId().toHexString();
  return { id, name: `Player ${id.slice(-4)}`, email: `${id}@test.dev`, isAnonymous: false, image: null, ...overrides };
}

export const guest = () => user({ isAnonymous: true, name: "Guest" });

/** A fetch stub that serves the given YouDoSudoku-style JSON bodies in order. */
export function apiFetch(...bodies: Array<{ status?: number; body: unknown } | Error>) {
  const calls: RequestInit[] = [];
  let k = 0;
  const impl = (async (_url: string | URL | Request, init?: RequestInit) => {
    calls.push(init ?? {});
    const next = bodies[Math.min(k++, bodies.length - 1)];
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return Object.assign(impl, { calls });
}

export const validApiBody = { difficulty: "hard", puzzle: API_PUZZLE, solution: API_SOLUTION };
