import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { screenshots } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { apiError, HttpError, uuidPattern } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession(request);
    const { id } = await params;
    if (!uuidPattern.test(id)) throw new HttpError(400, "Invalid screenshot identifier.");
    const settings = await getSettings();
    const cutoff = new Date(Date.now() - settings.screenshotRetentionDays * 86400_000);
    const [image] = await db.select().from(screenshots).where(and(eq(screenshots.id, id), gte(screenshots.createdAt, cutoff)));
    if (!image) throw new HttpError(404, "This screenshot is unavailable or its retention period has expired.");
    return new Response(new Uint8Array(image.data), { headers: {
      "Content-Type": image.contentType, "Content-Length": String(image.byteLength),
      "Content-Disposition": 'inline; filename="order-screenshot.png"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    } });
  } catch (error) { return apiError(error); }
}
