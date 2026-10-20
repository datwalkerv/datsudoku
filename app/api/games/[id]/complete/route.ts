import { completeGameSchema } from "@/lib/validation/schemas";
import { json, parseBody, requireUser, route } from "@/lib/http";
import { completeGame } from "@/lib/games/service";

/** Server-verified completion. Idempotent: repeated calls return the same result. */
export const POST = route(async (request: Request, { params }: RouteContext<"/api/games/[id]/complete">) => {
  const user = await requireUser(request);
  const { id } = await params;
  const input = await parseBody(request, completeGameSchema);
  return json({ result: await completeGame(user, id, input) });
});
