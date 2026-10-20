import { hintSchema } from "@/lib/validation/schemas";
import { json, parseBody, requireUser, route } from "@/lib/http";
import { requestHint } from "@/lib/games/service";

/** Reveals one cell and records the hint on the server (ranked games become unranked). */
export const POST = route(async (request: Request, { params }: RouteContext<"/api/games/[id]/hint">) => {
  const user = await requireUser(request);
  const { id } = await params;
  const { board, selected } = await parseBody(request, hintSchema);
  const hint = await requestHint(user.id, id, board, selected);
  return json({ hint: { i: hint.i, value: hint.value } });
});
