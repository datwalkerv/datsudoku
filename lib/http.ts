import "server-only";
import { NextResponse, connection } from "next/server";
import { ZodError, type ZodType } from "zod";
import { isDatabaseConfigured } from "@/lib/env";
import { getSessionUser, type SessionUser } from "@/lib/auth";
import { ensureIndexes } from "@/lib/db/collections";
import { HttpError } from "@/lib/errors";

export { HttpError };

export function jsonError(status: number, code: string, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, code, ...extra }, { status, headers: { "Cache-Control": "no-store" } });
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "Cache-Control": "private, no-store", ...(init?.headers ?? {}) },
  });
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Request body must be JSON");
  }
  return schema.parse(raw);
}

/** Resolves the authenticated user (registered or anonymous guest) or throws 401. */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request.headers);
  if (!user) throw new HttpError(401, "unauthorized", "Sign in or continue as a guest first");
  return user;
}

/**
 * Wraps a route handler with database checks and consistent error responses.
 */
export function route<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    // API responses are always request-time; never prerender them at build.
    await connection();
    if (!isDatabaseConfigured()) {
      return jsonError(503, "db_not_configured", "The database is not configured (MONGODB_URI)");
    }
    try {
      await ensureIndexes();
      return await handler(...args);
    } catch (error) {
      if (error instanceof HttpError) return jsonError(error.status, error.code, error.message, error.body);
      if (error instanceof ZodError) {
        return jsonError(400, "invalid_request", error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      }
      console.error("[api]", error);
      return jsonError(500, "internal_error", "Something went wrong");
    }
  };
}
