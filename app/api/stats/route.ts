import { json, requireUser, route } from "@/lib/http";
import { getStats } from "@/lib/stats/service";

export const GET = route(async (request: Request) => {
  const user = await requireUser(request);
  return json({ stats: await getStats(user.id), user: { name: user.name, isAnonymous: user.isAnonymous } });
});
