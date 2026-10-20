import "server-only";
import { MongoClient, type Db } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";
import { env } from "@/lib/env";

/**
 * A single MongoClient per function instance, reused across invocations
 * and hot reloads. The driver connects lazily on the first operation.
 */
const globalForMongo = globalThis as unknown as { __mongoClient?: MongoClient };

// Without MONGODB_URI the client points at an address that is never contacted;
// API routes check isDatabaseConfigured() and respond 503 before using it.
const uri = env.MONGODB_URI ?? "mongodb://127.0.0.1:1/unconfigured";

function createClient(): MongoClient {
  const client = new MongoClient(uri, {
    appName: "datsudoku",
    maxPoolSize: 10,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 8_000,
    // Bounds driver operations, including Better Auth transaction retries.
    timeoutMS: 15_000,
  });
  if (process.env.VERCEL) attachDatabasePool(client);
  return client;
}

export const client: MongoClient = (globalForMongo.__mongoClient ??= createClient());

export const db: Db = client.db(env.MONGODB_DB_NAME);
