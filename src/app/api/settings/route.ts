import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { applicationSettings } from "@/db/schema";
import { accessProvisioned, requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { apiError, checkOrigin, HttpError, rateLimit } from "@/lib/http";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireSession(request, ["admin"]);
    return Response.json({ settings: await getSettings(), security: { provisioned: accessProvisioned(), adminConfigured: Boolean(process.env.ADMIN_PASSWORD) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request) {
  try {
    checkOrigin(request);
    await requireSession(request, ["admin"]);
    rateLimit(request, "settings", 20);
    const body = await request.json();
    const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
    const companyInitials = typeof body.companyInitials === "string" ? body.companyInitials.trim().toUpperCase() : "";
    if (!companyName || companyName.length > 100 || !/^[A-Z0-9]{1,3}$/.test(companyInitials)) throw new HttpError(422, "Enter a company name and 1–3 letters or numbers for its monogram.");
    const ranges = { volume: [0, 100], repeatInterval: [3, 120], maxAlertDuration: [0, 86400], maxScreenshotMb: [1, 20], screenshotRetentionDays: [1, 3650] } as const;
    for (const [key, range] of Object.entries(ranges)) if (!Number.isInteger(body[key]) || body[key] < range[0] || body[key] > range[1]) throw new HttpError(422, `The ${key.replace(/([A-Z])/g, " $1").toLowerCase()} is outside its permitted range (${range[0]}–${range[1]}).`);
    if (typeof body.soundEnabled !== "boolean" || !["chime", "bell", "pulse"].includes(body.alertSound)) throw new HttpError(422, "Choose valid alert settings.");
    const [settings] = await db.transaction(async (tx) => {
      const result = await tx.update(applicationSettings).set({ companyName, companyInitials, soundEnabled: body.soundEnabled, alertSound: body.alertSound, volume: body.volume, repeatInterval: body.repeatInterval, maxAlertDuration: body.maxAlertDuration, maxScreenshotMb: body.maxScreenshotMb, screenshotRetentionDays: body.screenshotRetentionDays, alertBehavior: "until_acknowledged", updatedAt: sql`now()` }).where(eq(applicationSettings.id, "general")).returning();
      await tx.execute(sql`select pg_notify('picklane_updates', 'settings')`);
      return result;
    });
    return Response.json({ settings });
  } catch (error) { return apiError(error); }
}
