import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pickingRequests, orderStatusHistory } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { apiError, checkOrigin, HttpError, rateLimit, uuidPattern } from "@/lib/http";
import type { Status } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    await requireSession(request);
    const { id } = await context.params;
    if (!uuidPattern.test(id)) throw new HttpError(400, "Invalid request identifier.");
    const [order] = await db.select().from(pickingRequests).where(eq(pickingRequests.id, id));
    if (!order) throw new HttpError(404, "This request could not be found.");
    const history = await db.select().from(orderStatusHistory).where(eq(orderStatusHistory.pickingRequestId, id)).orderBy(asc(orderStatusHistory.changedAt));
    return Response.json({ request: order, history }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const scope = request.headers.get("x-picklane-workspace") === "display" ? "display" : "counter";
    const session = await requireSession(request, [scope]);
    rateLimit(request, "status-update", 180);
    const { id } = await context.params;
    if (!uuidPattern.test(id)) throw new HttpError(400, "Invalid request identifier.");
    const body = await request.json();
    const status = body.status as Status;
    if (!["ACKNOWLEDGED", "PICKING", "COMPLETED"].includes(status)) throw new HttpError(422, "Choose a valid next status.");
    if (scope === "counter" && status !== "COMPLETED") throw new HttpError(403, "Trade counter sessions can complete requests; picking actions require warehouse access.");
    const actor = `${scope}:${session.device}`;
    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(pickingRequests).where(eq(pickingRequests.id, id)).for("update");
      if (!current) throw new HttpError(404, "This request no longer exists.");
      if (current.status === status) return current;
      if (current.status === "COMPLETED") throw new HttpError(409, "This order has already been completed. The queue has been refreshed.");
      if ((status === "ACKNOWLEDGED" && current.status !== "NEW") || (status === "PICKING" && current.status !== "ACKNOWLEDGED")) throw new HttpError(409, "Another screen has already updated this order. The queue has been refreshed.");
      const timestamps = status === "ACKNOWLEDGED" ? { acknowledgedAt: sql`now()`, acknowledgedBy: actor } : status === "PICKING" ? { pickingStartedAt: sql`now()`, pickingStartedBy: actor } : { completedAt: sql`now()`, completedBy: actor };
      const [row] = await tx.update(pickingRequests).set({ status, ...timestamps, updatedAt: sql`now()` }).where(and(eq(pickingRequests.id, id), eq(pickingRequests.status, current.status))).returning();
      if (!row) throw new HttpError(409, "This request changed on another screen. Please try again.");
      await tx.insert(orderStatusHistory).values({ pickingRequestId: id, previousStatus: current.status, newStatus: status, changedBy: actor });
      await tx.execute(sql`select pg_notify('picklane_updates', ${JSON.stringify({ id, status })})`);
      return row;
    });
    return Response.json({ request: updated });
  } catch (error) { return apiError(error); }
}
