"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X, ZoomIn, ZoomOut, Scan, ImageIcon, Clock3, Check, Loader2, AlertCircle } from "lucide-react";
import type { PickingRequest, Status } from "@/lib/types";
import { statusLabels } from "@/lib/types";
import { clockTime, duration, fullDate } from "@/lib/format";

export function Modal({ children, onClose, className = "", labelledBy }: { children: ReactNode; onClose: () => void; className?: string; labelledBy: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal(); document.body.style.overflow = "hidden";
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={ref} aria-labelledby={labelledBy} className={`modal ${className}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-inner">{children}</div></dialog>;
}
export function ScreenshotViewer({ order, onClose }: { order: PickingRequest; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const abort = new AbortController(); let objectUrl = "";
    void fetch(`/api/screenshots/${order.screenshotPath}`, { signal: abort.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
      const blob = await response.blob(); objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);
    }).catch((err) => { if (!abort.signal.aborted) setError(err.message || "Screenshot could not be loaded."); });
    return () => { abort.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [order.screenshotPath]);
  return <Modal onClose={onClose} className="image-modal" labelledBy="screenshot-title">
    <div className="modal-header"><div><span className="eyebrow">ORDER SCREENSHOT</span><h2 id="screenshot-title">{order.orderNumber}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close screenshot"><X size={24} /></button></div>
    <div className="image-toolbar"><span><ImageIcon size={16} /> Original resolution {dimensions.width > 0 && `· ${dimensions.width} × ${dimensions.height}`}</span><div className="zoom-controls"><button className="icon-button" onClick={() => setZoom((z) => Math.max(.25, (z || 1) - .25))} aria-label="Zoom out" disabled={!url}><ZoomOut size={18} /></button><span>{zoom ? `${Math.round(zoom * 100)}%` : "Fit"}</span><button className="icon-button" onClick={() => setZoom((z) => Math.min(4, (z || .75) + .25))} aria-label="Zoom in" disabled={!url}><ZoomIn size={18} /></button><button className="button button-small" onClick={() => setZoom(0)} disabled={!url}><Scan size={15} /> Fit to screen</button></div></div>
    <div className={`image-stage ${zoom ? "zoomed" : ""}`}>
      {error ? <div className="viewer-state"><AlertCircle size={36} /><h3>Screenshot unavailable</h3><p>{error}</p></div> : !url ? <div className="viewer-state"><Loader2 className="spin" size={32} /><p>Loading private screenshot…</p></div> : <img src={url} alt={`Order ${order.orderNumber} screenshot`} onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} style={zoom ? { width: dimensions.width ? dimensions.width * zoom : "auto", maxWidth: "none", maxHeight: "none" } : { maxWidth: "100%", maxHeight: "calc(100dvh - 230px)", width: "auto" }} />}
    </div><div className="modal-footnote">Private attachment · Opening an image does not change the order status. Scroll to pan when zoomed.</div>
  </Modal>;
}
type Transition = { id: string; newStatus: Status; changedAt: string; changedBy: string };
export function RequestDetails({ order, onClose, onImage }: { order: PickingRequest; onClose: () => void; onImage: () => void }) {
  const [current, setCurrent] = useState(order);
  const [history, setHistory] = useState<Transition[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    void fetch(`/api/requests/${order.id}`, { signal: abort.signal }).then(async (res) => { const data = await res.json(); if (!res.ok) throw new Error(data.error); setCurrent(data.request); setHistory(data.history); }).catch((err) => { if (!abort.signal.aborted) setError(err.message); });
    return () => abort.abort();
  }, [order.id]);
  return <Modal onClose={onClose} className="details-modal" labelledBy="details-title"><div className="modal-header"><div><span className="eyebrow">PICKING REQUEST</span><h2 id="details-title">{current.orderNumber}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close order details"><X size={22} /></button></div>
    <div className="details-content"><span className={`status-badge ${current.status.toLowerCase()}`}><i />{statusLabels[current.status]}</span><p className="detail-message">{current.message || "No message was added to this request."}</p><div className="details-meta"><div><span>Submitted</span><strong>{fullDate(current.createdAt)} · {clockTime(current.createdAt, true)}</strong></div><div><span>{current.completedAt ? "Total turnaround" : "Elapsed time"}</span><strong><Clock3 size={15} />{duration(current.createdAt, current.completedAt || Date.now())}</strong></div></div>
    <h3 className="section-label">REQUEST TIMELINE</h3>{error && <p className="inline-error">{error}</p>}<div className="timeline">{history.map((event) => <div className="timeline-event" key={event.id}><span className={`timeline-dot ${event.newStatus.toLowerCase()}`}><Check size={13} /></span><div><strong>{event.newStatus === "NEW" ? "Request sent to warehouse" : statusLabels[event.newStatus]}</strong><p>{fullDate(event.changedAt)} · {clockTime(event.changedAt, true)}<span> · {event.changedBy.startsWith("counter") ? "Trade counter" : "Warehouse display"}</span></p></div></div>)}</div>
    {current.screenshotPath && <button className="button button-primary full-width" onClick={onImage}><ImageIcon size={17} /> View screenshot</button>}<p className="muted small">Request ID · {current.id}</p></div></Modal>;
}
