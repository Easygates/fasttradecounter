import { requireSession } from "@/lib/auth";
import { enforceRetention } from "@/lib/data";
import { apiError, checkOrigin, HttpError, safeEqual } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const bearer = request.headers.get("authorization");
    if (bearer) {
      const secret = process.env.RETENTION_CRON_TOKEN;
      if (!secret || !safeEqual(bearer, `Bearer ${secret}`)) throw new HttpError(401, "Invalid maintenance credentials.");
    } else { checkOrigin(request); await requireSession(request, ["admin"]); }
    return Response.json({ ok: true, removedScreenshots: await enforceRetention(true) });
  } catch (error) { return apiError(error); }
}
