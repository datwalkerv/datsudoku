import { inject, vi } from "vitest";

// "server-only" throws outside a React Server environment; tests run server modules directly.
vi.mock("server-only", () => ({}));

// Each test file gets its own database on the shared in-memory replica set.
process.env.MONGODB_URI = inject("mongoUri");
process.env.MONGODB_DB_NAME = `test_${Math.random().toString(36).slice(2, 10)}`;
process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.YOUDOSUDOKU_API_KEY = "test-key";
