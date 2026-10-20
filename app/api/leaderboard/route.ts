import { leaderboardQuerySchema } from "@/lib/validation/schemas";
import { json, route } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getLeaderboard } from "@/lib/leaderboard/service";

export const GET = route(async (request: Request) => {
  const query = leaderboardQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const user = await getSessionUser(request.headers);
  return json(await getLeaderboard(query, user?.id ?? null));
});
