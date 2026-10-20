import "server-only";
import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z.string().optional(),
  MONGODB_DB_NAME: z.string().default("datsudoku"),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_URL: z.url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  YOUDOSUDOKU_API_KEY: z.string().optional(),
  YOUDOSUDOKU_API_URL: z.url().default("https://www.youdosudoku.com/api"),
});

const parsed = schema.safeParse(
  Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])),
);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${z.prettifyError(parsed.error)}`);
}

/** Server-side environment. Never import this from client components. */
export const env = parsed.data;

export const isDatabaseConfigured = () => Boolean(env.MONGODB_URI);
export const isGoogleConfigured = () => Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
