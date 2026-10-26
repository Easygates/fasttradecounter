"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import type { PickingRequest, Snapshot, Status, Workspace } from "@/lib/types";
import { defaultSettings } from "@/lib/types";
import { ScreenshotViewer, RequestDetails } from "@/components/viewers";

type Connection = "connecting" | "connected" | "reconnecting" | "offline";
type ContextType = {
  snapshot: Snapshot | null; settings: typeof defaultSettings; connection: Connection; bootError: string;
  now: number; workspace: Workspace; busy: Set<string>;
  refresh: () => Promise<void>; retry: () => void;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
  updateRequest: (request: PickingRequest, status: Status) => Promise<void>;
  openScreenshot: (request: PickingRequest) => void; openDetails: (request: PickingRequest) => void;
};
const Context = createContext<ContextType | null>(null);
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error("Workspace provider required"); return value; }
export const apiHeaders = { "Content-Type": "application/json", "X-Requested-With": "picklane" };
export class ApiClientError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const data = await response.json();
  if (!response.ok) throw new ApiClientError(response.status, data.error || "This operation could not be completed.");
  return data as T;
}
export function WorkspaceProvider({ workspace, readOnly = false, children }: { workspace: Workspace; readOnly?: boolean; children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const [bootError, setBootError] = useState("");
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const [retryKey, setRetryKey] = useState(0);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const pending = useRef(new Set<string>());
  const sequence = useRef(0);
  const [toast, setToast] = useState<{ message: string; kind: "success" | "error" | "info" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageOrder, setImageOrder] = useState<PickingRequest | null>(null);
  const [detailOrder, setDetailOrder] = useState<PickingRequest | null>(null);
  const notify = useCallback((message: string, kind: "success" | "error" | "info" = "success") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = setTimeout(() => setToast(null), kind === "error" ? 9000 : 5500);
  }, []);
  const refresh = useCallback(async () => {
    const seq = ++sequence.current;
    const data = await fetchJson<Snapshot>(`/api/requests?tz=${new Date().getTimezoneOffset()}`);
    if (seq !== sequence.current) return;
    offset.current = new Date(data.serverTime).getTime() - Date.now();
    setSnapshot(data); setNow(Date.now() + offset.current); setBootError("");
  }, []);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset.current), 1000);
    return () => { clearInterval(tick); if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let lastEvent = Date.now();
    let renewing = false;
    let streamReady = false;
    let snapshotRetry: ReturnType<typeof setTimeout> | null = null;
    let bootRetry: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 2000;
    const markEvent = () => { lastEvent = Date.now(); };
    const sync = async () => {
      if (cancelled) return;
      if (snapshotRetry) { clearTimeout(snapshotRetry); snapshotRetry = null; }
      markEvent();
      try {
        await refresh();
        if (!cancelled) { retryDelay = 2000; setConnection(streamReady ? "connected" : "reconnecting"); }
      } catch {
        if (!cancelled) {
          setConnection(navigator.onLine ? "reconnecting" : "offline");
          if (navigator.onLine) { snapshotRetry = setTimeout(() => { void sync(); }, retryDelay); retryDelay = Math.min(15000, retryDelay * 2); }
        }
      }
    };
    const connect = () => {
      if (cancelled) return;
      source?.close(); streamReady = false; lastEvent = Date.now();
      source = new EventSource("/api/events");
      source.addEventListener("ready", () => { streamReady = true; void sync(); });
      source.addEventListener("change", () => { void sync(); });
      source.addEventListener("heartbeat", () => { markEvent(); });
      source.addEventListener("unavailable", () => { streamReady = false; if (!cancelled) setConnection("reconnecting"); });
      source.onerror = () => { streamReady = false; if (!cancelled) setConnection(navigator.onLine ? "reconnecting" : "offline"); };
    };
    const initialise = async () => {
      if (cancelled) return;
      if (bootRetry) { clearTimeout(bootRetry); bootRetry = null; }
      setConnection("connecting"); setBootError("");
      try {
        const params = new URLSearchParams(location.search);
        const token = params.get("access");
        if (readOnly && !token) {
          try { await refresh(); if (!cancelled) { connect(); return; } } catch {}
        }
        await fetchJson("/api/session", { method: "POST", headers: apiHeaders, body: JSON.stringify({ role: workspace, token }) });
        if (token) { params.delete("access"); history.replaceState(null, "", `${location.pathname}${params.size ? `?${params}` : ""}`); }
        if (cancelled) return;
        await refresh(); if (!cancelled) connect();
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : "The workspace could not connect."); setConnection("offline");
          if (!(error instanceof ApiClientError && [401, 403].includes(error.status))) bootRetry = setTimeout(() => { void initialise(); }, 5000);
        }
      }
    };
    const offline = () => setConnection("offline");
    const online = () => { setConnection("reconnecting"); if (source) connect(); else void initialise(); };
    const visibility = () => { if (document.visibilityState === "visible" && source) { setConnection("reconnecting"); connect(); } };
    const watchdog = setInterval(() => {
      if (source && navigator.onLine && Date.now() - lastEvent > 40000 && !renewing) { renewing = true; setConnection("reconnecting"); connect(); renewing = false; }
    }, 5000);
    window.addEventListener("offline", offline); window.addEventListener("online", online); document.addEventListener("visibilitychange", visibility);
    void initialise();
    return () => { cancelled = true; source?.close(); if (snapshotRetry) clearTimeout(snapshotRetry); if (bootRetry) clearTimeout(bootRetry); clearInterval(watchdog); window.removeEventListener("offline", offline); window.removeEventListener("online", online); document.removeEventListener("visibilitychange", visibility); };
  }, [workspace, readOnly, refresh, retryKey]);
  // Recalculate the local business day without polling order data.
  const dayKey = new Date(now).toLocaleDateString();
  const previousDay = useRef(dayKey);
  useEffect(() => { if (previousDay.current !== dayKey) { previousDay.current = dayKey; void refresh().catch(() => {}); } }, [dayKey, refresh]);
  const updateRequest = useCallback(async (order: PickingRequest, status: Status) => {
    if (pending.current.has(order.id)) return;
    pending.current.add(order.id); setBusy(new Set(pending.current));
    try {
      await fetchJson(`/api/requests/${order.id}`, { method: "PATCH", headers: { ...apiHeaders, "X-Picklane-Workspace": workspace }, body: JSON.stringify({ status }) });
      await refresh();
      notify(`${order.orderNumber} ${status === "COMPLETED" ? "marked as completed" : status === "PICKING" ? "is now being picked" : "acknowledged"}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "The order could not be updated.", "error");
      await refresh().catch(() => setConnection("reconnecting"));
    } finally { pending.current.delete(order.id); setBusy(new Set(pending.current)); }
  }, [workspace, refresh, notify]);
  return <Context.Provider value={{ snapshot, settings: snapshot?.settings || defaultSettings, connection, bootError, now, workspace, busy, refresh, retry: () => setRetryKey((n) => n + 1), notify, updateRequest, openScreenshot: setImageOrder, openDetails: setDetailOrder }}>
    {children}
    {toast && <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>{toast.kind === "error" ? <CircleAlert size={21} /> : <CheckCircle2 size={21} />}<span>{toast.message}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={17} /></button></div>}
    {imageOrder && <ScreenshotViewer order={imageOrder} onClose={() => setImageOrder(null)} />}
    {detailOrder && <RequestDetails order={detailOrder} onClose={() => setDetailOrder(null)} onImage={() => { setDetailOrder(null); setImageOrder(detailOrder); }} />}
  </Context.Provider>;
}
