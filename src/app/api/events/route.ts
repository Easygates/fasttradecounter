import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireSession } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { realtime } from "@/lib/realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const encoder = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let unsubscribe: (() => void) | undefined;
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        const close = () => {
          if (closed) return;
          closed = true; unsubscribe?.(); if (heartbeat) clearInterval(heartbeat);
          request.signal.removeEventListener("abort", close);
          try { controller.close(); } catch {}
        };
        cleanup = close;
        const send = (event: string) => {
          if (closed) return;
          try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify({ serverTime: new Date().toISOString() })}\n\n`)); } catch { close(); }
        };
        controller.enqueue(encoder.encode("retry: 2000\n\n"));
        request.signal.addEventListener("abort", close);
        void realtime.subscribe((event) => { send(event); if (event === "unavailable") close(); }).then((unsub) => {
          if (closed) { unsub(); return; }
          unsubscribe = unsub;
          send("ready");
          heartbeat = setInterval(() => {
            if (session.expires < Date.now() || !realtime.online) { send("unavailable"); close(); return; }
            void db.execute(sql`select 1`).then(() => send("heartbeat")).catch(() => { send("unavailable"); close(); });
          }, 15000);
        }).catch(() => { send("unavailable"); close(); });
      },
      cancel() { cleanup(); },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
