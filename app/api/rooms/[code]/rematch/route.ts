import { z } from "zod";
import { roomCodeSchema } from "@/lib/validation/schemas";
import { json, parseBody, requireUser, route } from "@/lib/http";
import { getRoomView, startRematch } from "@/lib/multiplayer/service";

const bodySchema = z.object({ round: z.number().int().min(0) });

/** Host-only: starts the next round. `round` is the round the host is looking at. */
export const POST = route(async (request: Request, { params }: RouteContext<"/api/rooms/[code]/rematch">) => {
  const code = roomCodeSchema.parse((await params).code);
  const user = await requireUser(request);
  const { round } = await parseBody(request, bodySchema);
  await startRematch(user, code, round);
  return json({ room: await getRoomView(user, code) });
});
