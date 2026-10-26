import "server-only";
import { Client } from "pg";

type Listener = (event: "change" | "ready" | "unavailable") => void;
class RealtimeHub {
  listeners = new Set<Listener>();
  client: Client | null = null;
  connecting: Promise<void> | null = null;
  retry: ReturnType<typeof setTimeout> | null = null;
  online = false;
  emit(event: "change" | "ready" | "unavailable") { for (const listener of this.listeners) listener(event); }
  async connect() {
    if (this.online) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: "picklane_realtime", keepAlive: true });
      this.client = client;
      const lost = () => {
        if (this.client !== client) return;
        this.client = null; this.online = false; this.emit("unavailable");
        void client.end().catch(() => {});
        if (!this.retry) this.retry = setTimeout(() => { this.retry = null; void this.connect().catch(() => {}); }, 2500);
      };
      client.on("error", lost);
      client.on("end", lost);
      client.on("notification", () => this.emit("change"));
      try {
        await client.connect();
        // LISTEN is transport setup; all application data uses Drizzle.
        await client.query("LISTEN picklane_updates");
        this.online = true; this.emit("ready");
      } catch (error) { lost(); throw error; }
    })().finally(() => { this.connecting = null; });
    return this.connecting;
  }
  async subscribe(listener: Listener) {
    this.listeners.add(listener);
    try { await this.connect(); } catch { this.listeners.delete(listener); throw new Error("Realtime database connection unavailable"); }
    return () => this.listeners.delete(listener);
  }
}
const globalHub = globalThis as typeof globalThis & { __picklaneHub?: RealtimeHub };
export const realtime = globalHub.__picklaneHub ??= new RealtimeHub();
