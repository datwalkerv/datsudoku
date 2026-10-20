import { roomCodeSchema } from "@/lib/validation/schemas";
import { json, requireUser, route } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getRoomView, joinRoom } from "@/lib/multiplayer/service";

/** Polled by the room page for participants, progress and results. */
export const GET = route(async (request: Request, { params }: RouteContext<"/api/rooms/[code]">) => {
  const code = roomCodeSchema.parse((await params).code);
  const user = await getSessionUser(request.headers);
  return json({ room: await getRoomView(user, code) });
});

/** Joins the room (idempotent) and returns this player's game for the current round. */
export const POST = route(async (request: Request, { params }: RouteContext<"/api/rooms/[code]">) => {
  const code = roomCodeSchema.parse((await params).code);
  const user = await requireUser(request);
  const { game } = await joinRoom(user, code);
  return json({ game, room: await getRoomView(user, code) });
});
