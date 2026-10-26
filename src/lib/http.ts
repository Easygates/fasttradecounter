import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function apiError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error("[Picklane] Request failed:", error);
  return Response.json({ error: "The server couldn’t finish this operation. Please retry; your entered details are safe." }, { status: 500 });
}
export function safeEqual(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const hosts = [request.headers.get("host"), request.headers.get("x-forwarded-host"), new URL(request.url).host];
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && !hosts.includes(new URL(origin).host))) {
    throw new HttpError(403, "Cross-site requests are not permitted.");
  }
  if (!origin && request.headers.get("x-requested-with") !== "picklane") throw new HttpError(403, "A same-origin application request is required.");
}
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(request: Request, category: string, limit = 60) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "local";
  const key = `${category}:${ip}`;
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) { bucket = { count: 0, reset: now + 60_000 }; buckets.set(key, bucket); }
  if (++bucket.count > limit) throw new HttpError(429, "Too many attempts. Please wait a minute and try again.");
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
}
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
