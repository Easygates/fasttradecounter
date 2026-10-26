import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { pickingRequests, orderStatusHistory, screenshots } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { getSettings, getSnapshot } from "@/lib/data";
import { apiError, checkOrigin, HttpError, rateLimit, uuidPattern } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireSession(request);
    const rawOffset = Number(new URL(request.url).searchParams.get("tz") || 0);
    const offset = Number.isFinite(rawOffset) && Math.abs(rawOffset) <= 840 ? rawOffset : 0;
    return Response.json(await getSnapshot(offset), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
async function limitedForm(request: Request, limit: number) {
  if (Number(request.headers.get("content-length") || 0) > limit) throw new HttpError(413, "The attachment is too large for the configured upload limit.");
  if (!request.body) throw new HttpError(400, "The request body is missing.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > limit) { await reader.cancel(); throw new HttpError(413, "The attachment is too large for the configured upload limit."); }
    chunks.push(part.value);
  }
  return new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const session = await requireSession(request, ["counter"]);
    rateLimit(request, "new-request", 45);
    const settings = await getSettings();
    const form = await limitedForm(request, settings.maxScreenshotMb * 1024 * 1024 + 65536);
    const orderNumber = String(form.get("orderNumber") || "").trim();
    const message = String(form.get("message") || "").trim();
    const submissionKey = String(form.get("submissionKey") || "");
    if (!/^[A-Za-z0-9-]{1,80}$/.test(orderNumber)) throw new HttpError(422, "Enter an order number using letters, numbers, or hyphens (up to 80 characters).");
    if (message.length > 1000) throw new HttpError(422, "Keep the message to 1,000 characters or fewer.");
    if (!uuidPattern.test(submissionKey)) throw new HttpError(422, "The submission identifier is invalid. Please reload this page.");
    const [existing] = await db.select().from(pickingRequests).where(eq(pickingRequests.submissionKey, submissionKey));
    if (existing) {
      if (existing.orderNumber !== orderNumber || (existing.message || "") !== message || Boolean(existing.screenshotPath) !== (form.get("screenshot") instanceof File && (form.get("screenshot") as File).size > 0)) {
        return Response.json({ code: "IDEMPOTENCY_MISMATCH", error: "Your earlier attempt was already saved. These edited details have been kept. Review the queue, then send again to create a separate request." }, { status: 409 });
      }
      return Response.json({ request: existing, duplicate: true });
    }
    const attachment = form.get("screenshot");
    let image: Buffer | null = null;
    if (attachment instanceof File && attachment.size > 0) {
      if (attachment.size > settings.maxScreenshotMb * 1024 * 1024) throw new HttpError(413, `Choose an image smaller than ${settings.maxScreenshotMb} MB.`);
      if (!["image/png", "image/jpeg", "image/webp"].includes(attachment.type)) throw new HttpError(422, "Use a PNG, JPEG, or WebP image. Other clipboard formats are not supported.");
      try {
        const input = Buffer.from(await attachment.arrayBuffer());
        const decoder = sharp(input, { limitInputPixels: 40_000_000, failOn: "warning" });
        const metadata = await decoder.metadata();
        if (!["png", "jpeg", "webp"].includes(metadata.format || "") || (metadata.pages || 1) > 1) throw new Error("Unsupported image content");
        // Full decode validates contents; lossless PNG preserves text and strips metadata.
        image = await decoder.rotate().png({ compressionLevel: 6 }).toBuffer();
        if (image.length > 40 * 1024 * 1024) throw new Error("Decoded image too large");
      } catch { throw new HttpError(422, "This image could not be safely processed. Try a smaller PNG or JPEG screenshot; your form has been preserved."); }
    } else if (attachment !== null && !(attachment instanceof File)) throw new HttpError(422, "The screenshot attachment is invalid.");
    const id = randomUUID();
    const imageId = image ? randomUUID() : null;
    const actor = `counter:${session.device}`;
    const result = await db.transaction(async (tx) => {
      const [created] = await tx.insert(pickingRequests).values({ id, submissionKey, orderNumber, message: message || null, screenshotPath: imageId, createdBy: actor }).onConflictDoNothing({ target: pickingRequests.submissionKey }).returning();
      if (!created) {
        const [duplicate] = await tx.select().from(pickingRequests).where(eq(pickingRequests.submissionKey, submissionKey));
        return { request: duplicate, duplicate: true };
      }
      if (image && imageId) await tx.insert(screenshots).values({ id: imageId, pickingRequestId: id, contentType: "image/png", byteLength: image.length, data: image });
      await tx.insert(orderStatusHistory).values({ pickingRequestId: id, newStatus: "NEW", changedBy: actor });
      await tx.execute(sql`select pg_notify('picklane_updates', ${JSON.stringify({ id, status: "NEW" })})`);
      return { request: created, duplicate: false };
    });
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (error) { return apiError(error); }
}
