import { createRoomSchema } from "@/lib/validation/schemas";
import { json, parseBody, requireUser, route } from "@/lib/http";
import { createRoom, joinRoom, listMyRooms } from "@/lib/multiplayer/service";

export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  const { difficulty, maxPlayers } = await parseBody(request, createRoomSchema);
  const room = await createRoom(user, difficulty, maxPlayers);
  const { game } = await joinRoom(user, room.code);
  return json({ code: room.code, path: `/multiplayer/${room.code}`, game }, { status: 201 });
});

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return json({ rooms: await listMyRooms(user.id) });
});
