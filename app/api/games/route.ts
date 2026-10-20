import { createGameSchema } from "@/lib/validation/schemas";
import { json, parseBody, requireUser, route } from "@/lib/http";
import { listGames, startClassicGame } from "@/lib/games/service";

/** Starts a Classic game with a verified, stored puzzle. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  const { difficulty } = await parseBody(request, createGameSchema);
  const { game, fallbackReason } = await startClassicGame(user, difficulty);
  return json({ game, fallbackReason }, { status: 201 });
});

/** Lists the current user's recent games. */
export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  const params = new URL(request.url).searchParams;
  const status = params.get("status");
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || 20));
  const games = await listGames(user.id, status === "active" || status === "completed" ? status : undefined, limit);
  return json({ games });
});
