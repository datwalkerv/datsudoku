import { saveGameSchema } from "@/lib/validation/schemas";
import { json, parseBody, requireUser, route } from "@/lib/http";
import { getGameWithResult, saveGame } from "@/lib/games/service";

export const GET = route(async (request: Request, { params }: RouteContext<"/api/games/[id]">) => {
  const user = await requireUser(request);
  const { id } = await params;
  return json({ game: await getGameWithResult(user.id, id) });
});

/**
 * Saves progress. Accepted only when `baseVersion` matches the stored version;
 * otherwise responds 409 with the newer server game so the client can resolve.
 */
export const PUT = route(async (request: Request, { params }: RouteContext<"/api/games/[id]">) => {
  const user = await requireUser(request);
  const { id } = await params;
  const input = await parseBody(request, saveGameSchema);
  return json(await saveGame(user.id, id, input));
});
