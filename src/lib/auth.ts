import "server-only";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { applicationSecrets } from "@/db/schema";
import { HttpError, safeEqual } from "@/lib/http";
import type { Workspace } from "@/lib/types";

type Session = { roles: (Workspace | "admin")[]; device: string; expires: number };
let secretPromise: Promise<string> | undefined;
async function secret() {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
    return process.env.SESSION_SECRET;
  }
  if (!secretPromise) secretPromise = (async () => {
    await db.insert(applicationSecrets).values({ key: "session_signing_key", value: randomBytes(48).toString("hex") }).onConflictDoNothing();
    const [row] = await db.select().from(applicationSecrets).where(eq(applicationSecrets.key, "session_signing_key"));
    return row.value;
  })().catch((error) => { secretPromise = undefined; throw error; });
  return secretPromise;
}
async function sign(value: string) { return createHmac("sha256", await secret()).update(`${accessProvisioned() ? "provisioned" : "trusted-network"}:${value}`).digest("base64url"); }
function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${name}=`))?.slice(name.length + 1);
}
export async function readSession(request: Request, admin = false): Promise<Session | null> {
  const raw = cookieValue(request, admin ? "pl_admin" : "pl_device");
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 2 || !safeEqual(await sign(parts[0]), parts[1])) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString()) as Session;
    if (!Array.isArray(payload.roles) || !payload.device || payload.expires < Date.now()) return null;
    return payload;
  } catch { return null; }
}
export async function requireSession(request: Request, roles: (Workspace | "admin")[] = ["counter", "display"]) {
  const session = await readSession(request, roles.includes("admin"));
  if (!session || !roles.some((role) => session.roles.includes(role))) throw new HttpError(401, roles.includes("admin") ? "Administrator access is required." : "This device is not connected. Open an authorised workspace access link.");
  return session;
}
export function accessProvisioned() {
  return process.env.ACCESS_MODE === "provisioned" || Boolean(process.env.COUNTER_ACCESS_TOKEN || process.env.WAREHOUSE_ACCESS_TOKEN);
}
export async function deviceCookie(request: Request, role: Workspace, token?: string) {
  if (accessProvisioned()) {
    const expected = role === "display" ? process.env.WAREHOUSE_ACCESS_TOKEN : process.env.COUNTER_ACCESS_TOKEN;
    const existing = await readSession(request);
    if (!existing?.roles.includes(role) && (!expected || !token || !safeEqual(expected, token))) {
      throw new HttpError(401, "This device needs an authorised access link. Ask your administrator for this workspace’s provisioning URL.");
    }
  }
  const existing = await readSession(request);
  const roles = Array.from(new Set<Workspace>([...(existing?.roles.filter((r): r is Workspace => r !== "admin") || []), role]));
  return makeCookie(request, "pl_device", { roles, device: existing?.device || randomUUID(), expires: Date.now() + 30 * 86400_000 }, 30 * 86400);
}
export async function adminCookie(request: Request, password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new HttpError(503, "Administrator access is locked. Configure ADMIN_PASSWORD on the server to enable protected settings.");
  if (expected.length < 12) throw new HttpError(503, "Administrator access is locked. ADMIN_PASSWORD must contain at least 12 characters.");
  if (!safeEqual(expected, password)) throw new HttpError(401, "That administrator password is not correct.");
  return makeCookie(request, "pl_admin", { roles: ["admin"], device: randomUUID(), expires: Date.now() + 3600_000 }, 3600);
}
async function makeCookie(request: Request, name: string, payload: Session, maxAge: number) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secure = new URL(request.url).protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  return `${name}=${value}.${await sign(value)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}
