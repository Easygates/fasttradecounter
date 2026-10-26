import "server-only";
import { db } from "@/db";
import { applicationSettings, pickingRequests, screenshots } from "@/db/schema";
import { and, asc, desc, eq, gte, lt, ne, sql } from "drizzle-orm";

export async function getSettings() {
  await db.insert(applicationSettings).values({ id: "general" }).onConflictDoNothing();
  const [settings] = await db.select().from(applicationSettings).where(eq(applicationSettings.id, "general"));
  return settings;
}
let nextCleanup = 0;
export async function enforceRetention(force = false) {
  if (!force && Date.now() < nextCleanup) return 0;
  nextCleanup = Date.now() + 3600_000;
  try {
    const settings = await getSettings();
    const cutoff = new Date(Date.now() - settings.screenshotRetentionDays * 86400_000);
    return await db.transaction(async (tx) => {
      const expired = await tx.delete(screenshots).where(lt(screenshots.createdAt, cutoff)).returning({ requestId: screenshots.pickingRequestId });
      for (const row of expired) await tx.update(pickingRequests).set({ screenshotPath: null, updatedAt: sql`now()` }).where(eq(pickingRequests.id, row.requestId));
      if (expired.length) await tx.execute(sql`select pg_notify('picklane_updates', 'retention')`);
      return expired.length;
    });
  } catch (error) { nextCleanup = 0; console.error("Screenshot retention failed", error); if (force) throw error; return 0; }
}
export async function getSnapshot(timezoneOffset = 0) {
  await enforceRetention();
  const settings = await getSettings();
  const shifted = new Date(Date.now() - timezoneOffset * 60_000);
  const start = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) + timezoneOffset * 60_000);
  const end = new Date(start.getTime() + 86400_000);
  return db.transaction(async (tx) => {
    const active = await tx.select().from(pickingRequests).where(ne(pickingRequests.status, "COMPLETED")).orderBy(asc(pickingRequests.createdAt));
    const completed = await tx.select().from(pickingRequests).where(and(eq(pickingRequests.status, "COMPLETED"), gte(pickingRequests.completedAt, start), lt(pickingRequests.completedAt, end))).orderBy(desc(pickingRequests.completedAt)).limit(100);
    const [totals] = await tx.select({ total: sql<number>`count(*)::int` }).from(pickingRequests).where(and(eq(pickingRequests.status, "COMPLETED"), gte(pickingRequests.completedAt, start), lt(pickingRequests.completedAt, end)));
    return {
      settings, requests: [...active, ...completed], serverTime: new Date().toISOString(),
      counts: { NEW: active.filter((r) => r.status === "NEW").length, ACKNOWLEDGED: active.filter((r) => r.status === "ACKNOWLEDGED").length, PICKING: active.filter((r) => r.status === "PICKING").length, COMPLETED: totals.total, active: active.length },
    };
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
