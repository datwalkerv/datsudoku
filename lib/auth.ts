import "server-only";
import { betterAuth } from "better-auth";
import { anonymous } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { headers } from "next/headers";
import { client, db } from "@/lib/db/mongodb";
import { env, isGoogleConfigured } from "@/lib/env";
import { deleteUserData, migrateGuestData } from "@/lib/games/link";

export const auth = betterAuth({
  appName: "Sudoku",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(db, { client }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  socialProviders: isGoogleConfigured()
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID!,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},
  user: {
    deleteUser: {
      enabled: true,
      // Removes the user's app data; leaderboards drop their entries with it.
      afterDelete: async (user) => {
        await deleteUserData(user.id);
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 60,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    // Serverless instances do not share memory, so counters live in MongoDB.
    storage: "database",
    // Guests sign in silently on first visit; allow for several devices behind one IP.
    customRules: { "/sign-in/anonymous": { window: 60, max: 30 } },
  },
  plugins: [
    anonymous({
      generateName: () => "Guest",
      // Both ids come from Better Auth's own session handling, never from the
      // client, so a user can only ever claim the guest data in their browser.
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await migrateGuestData(anonymousUser.user.id, newUser.user.id, newUser.user.name);
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  isAnonymous: boolean;
  image: string | null;
}

/** Reads and validates the current session on the server. */
export async function getSessionUser(requestHeaders?: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
  if (!session) return null;
  const u = session.user as Session["user"] & { isAnonymous?: boolean | null };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    isAnonymous: Boolean(u.isAnonymous),
    image: u.image ?? null,
  };
}
