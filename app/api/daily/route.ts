import { json, requireUser, route } from "@/lib/http";
import { getSessionUser } from "@/lib/auth";
import { getDailyStatus, startDailyGame } from "@/lib/daily/service";
import { utcDateKey } from "@/lib/daily/date";

/** Today's challenge (UTC) and the viewer's status. */
export const GET = route(async (request: Request) => {
  const user = await getSessionUser(request.headers);
  return json(await getDailyStatus(user, utcDateKey()));
});

/** Starts or resumes today's challenge. Only today's date can be started. */
export const POST = route(async (request: Request) => {
  const user = await requireUser(request);
  return json({ game: await startDailyGame(user, utcDateKey()) });
});
