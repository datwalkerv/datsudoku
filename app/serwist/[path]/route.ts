import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// Versions the precached app shells so a new deployment replaces them.
const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
  crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  // App shells that must open offline. Game data itself comes from IndexedDB.
  additionalPrecacheEntries: ["/", "/play", "/~offline", "/settings", "/install"].map((url) => ({ url, revision })),
  swSrc: "app/sw.ts",
  useNativeEsbuild: true,
});
