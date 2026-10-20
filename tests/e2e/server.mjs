// Starts an in-memory MongoDB replica set, then `next start` against it.
// Used by playwright.config.ts as the web server for end-to-end tests.
import { spawn } from "node:child_process";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
const port = process.env.E2E_PORT ?? "3100";
const child = spawn("pnpm", ["exec", "next", "start", "--port", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    MONGODB_URI: replSet.getUri(),
    MONGODB_DB_NAME: "e2e",
    BETTER_AUTH_URL: `http://localhost:${port}`,
    BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-123456",
    // No external calls in tests: puzzles come from the verified internal generator.
    YOUDOSUDOKU_API_KEY: "",
    GOOGLE_CLIENT_ID: "e2e-google-client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "e2e-google-secret",
  },
});
const stop = async () => {
  child.kill("SIGTERM");
  await replSet.stop();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
child.on("exit", async (code) => {
  await replSet.stop();
  process.exit(code ?? 0);
});
