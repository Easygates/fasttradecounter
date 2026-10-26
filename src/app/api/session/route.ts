import { adminCookie, deviceCookie, accessProvisioned, readSession } from "@/lib/auth";
import { apiError, checkOrigin, HttpError, rateLimit } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const admin = await readSession(request, true);
    return Response.json({ admin: Boolean(admin?.roles.includes("admin")), adminConfigured: Boolean(process.env.ADMIN_PASSWORD), provisioned: accessProvisioned() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    if (body.action === "admin") {
      rateLimit(request, "admin-login", 5);
      if (typeof body.password !== "string" || body.password.length > 512) throw new HttpError(400, "Enter your administrator password.");
      const cookie = await adminCookie(request, body.password);
      return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
    }
    if (body.action === "logout") return Response.json({ ok: true }, { headers: { "Set-Cookie": "pl_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" } });
    rateLimit(request, "device-session", 60);
    if (body.role !== "counter" && body.role !== "display") throw new HttpError(400, "Choose a valid workspace.");
    const cookie = await deviceCookie(request, body.role, typeof body.token === "string" ? body.token : undefined);
    return Response.json({ ok: true, provisioned: accessProvisioned() }, { headers: { "Set-Cookie": cookie } });
  } catch (error) { return apiError(error); }
}
