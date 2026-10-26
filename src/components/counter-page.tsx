"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowUpRight, MonitorUp, Package, Bell, PackageCheck, CircleCheck, Search, ArrowDownWideNarrow, Clock3, ImageIcon, Check, Loader2, X, Radio, ArrowRight } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import { RequestForm } from "@/components/request-form";
import { QueueIllustration, WorkflowStrip } from "@/components/brand";
import { clockTime, duration } from "@/lib/format";
import { statusLabels, type PickingRequest } from "@/lib/types";

export function SummaryCards({ warehouse = false }: { warehouse?: boolean }) {
  const { snapshot } = useWorkspace();
  const counts = snapshot?.counts;
  const cards = warehouse ? [
    { label: "New requests", value: counts?.NEW, note: "Waiting for acknowledgement", icon: Bell, tone: "orange" },
    { label: "Acknowledged", value: counts?.ACKNOWLEDGED, note: "Ready to start picking", icon: CircleCheck, tone: "amber" },
    { label: "Being picked", value: counts?.PICKING, note: "On the warehouse floor", icon: PackageCheck, tone: "blue" },
    { label: "Completed today", value: counts?.COMPLETED, note: "Picked, packed, and ready", icon: Check, tone: "green" },
  ] : [
    { label: "Active requests", value: counts?.active, note: "In the warehouse queue", icon: Package, tone: "teal" },
    { label: "New requests", value: counts?.NEW, note: "Awaiting acknowledgement", icon: Bell, tone: "orange" },
    { label: "Being picked", value: counts?.PICKING, note: "Your warehouse is on it", icon: PackageCheck, tone: "blue" },
    { label: "Completed today", value: counts?.COMPLETED, note: "Another smooth handoff", icon: CircleCheck, tone: "green" },
  ];
  return <div className="summary-grid">{cards.map((card) => <div className={`summary-card ${card.tone}`} key={card.label}><div className="summary-card-top"><span>{card.label}</span><span className="summary-icon"><card.icon size={20} strokeWidth={1.65}/></span></div><strong>{card.value === undefined ? "—" : String(card.value).padStart(2, "0")}</strong><div className="summary-note"><i/>{card.note}</div></div>)}</div>;
}
export function StatusBadge({ status }: { status: PickingRequest["status"] }) {
  return <span className={`status-badge ${status.toLowerCase()}`}><i/>{statusLabels[status]}</span>;
}
function CounterOrderRow({ order }: { order: PickingRequest }) {
  const { now, busy, updateRequest, openScreenshot, openDetails, connection } = useWorkspace();
  const completed = order.status === "COMPLETED";
  return <article className={`counter-order-row ${order.status.toLowerCase()}`}><span className="order-status-rail"/><div className="counter-order-main"><div className="counter-order-title"><button className="order-number-button" onClick={() => openDetails(order)}>{order.orderNumber}</button><StatusBadge status={order.status}/></div>{order.message && <p className="counter-order-message">{order.message}</p>}<div className="counter-order-meta"><span><Clock3 size={12}/>{clockTime(order.createdAt)}<i/> {completed && order.completedAt ? `${duration(order.createdAt, order.completedAt)} total` : `${duration(order.createdAt, now)} ago`}</span>{order.screenshotPath && <button className="text-button screenshot-link" onClick={() => openScreenshot(order)}><ImageIcon size={12}/>Screenshot</button>}</div>{completed && order.completedAt && <span className="completion-caption">Completed at {clockTime(order.completedAt)}</span>}</div>{!completed && <button className="button complete-order-button" disabled={busy.has(order.id) || connection !== "connected"} onClick={() => void updateRequest(order, "COMPLETED")} title={`Mark ${order.orderNumber} as completed`}>{busy.has(order.id) ? <Loader2 className="spin" size={15}/> : <Check size={15}/>}<span>Complete</span></button>}{completed && <CircleCheck size={21} className="completed-row-icon"/>}</article>;
}
export function CounterPage() {
  const { snapshot, connection } = useWorkspace();
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [filter, setFilter] = useState("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [oldest, setOldest] = useState(true);
  const requests = useMemo(() => (snapshot?.requests || []).filter((r) => (tab === "active" ? r.status !== "COMPLETED" : r.status === "COMPLETED") && (tab === "completed" || filter === "all" || (filter === "new" ? r.status === "NEW" : ["ACKNOWLEDGED", "PICKING"].includes(r.status))) && (!query || r.orderNumber.toLowerCase().includes(query.toLowerCase()) || r.message?.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * (oldest ? 1 : -1)), [snapshot, tab, filter, query, oldest]);
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> YOUR COUNTER, CONNECTED</div><h1>Warehouse picking requests<span className="heading-period">.</span></h1><p>Send it from the counter. Keep every pick moving.</p></div><Link href="/warehouse" target="_blank" rel="noopener noreferrer" className="button open-display-button"><MonitorUp size={17}/>Open warehouse display<ArrowUpRight size={16}/></Link></div>
    <SummaryCards/>
    <div className="counter-layout"><RequestForm/><div className="queue-side"><section className="panel live-requests-panel"><div className="live-panel-heading"><div className="live-panel-tabs"><button className={tab === "active" ? "active" : ""} onClick={() => { setTab("active"); setFilter("all"); }}>Active requests <span>{snapshot?.counts.active || 0}</span></button><button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Completed today <span>{snapshot?.counts.COMPLETED || 0}</span></button></div><button className={`icon-button ${searchOpen ? "selected" : ""}`} aria-label="Search requests" onClick={() => { setSearchOpen(!searchOpen); setQuery(""); }}>{searchOpen ? <X size={17}/> : <Search size={17}/>}</button></div>
      <div className="queue-toolbar">{searchOpen ? <div className="input-with-icon compact-search"><Search size={15}/><input autoFocus aria-label="Search active requests" placeholder="Find an order or message…" value={query} onChange={(e) => setQuery(e.target.value)}/></div> : <div className="queue-filters">{tab === "active" ? [{ id:"all",label:"All requests" }, { id:"new",label:"New" }, { id:"progress",label:"In progress" }].map((item) => <button className={filter === item.id ? "active" : ""} key={item.id} onClick={() => setFilter(item.id)}>{item.label}{item.id === "new" && (snapshot?.counts.NEW || 0) > 0 && <span>{snapshot?.counts.NEW}</span>}</button>) : <span className="muted small">A good day’s work, all in one place.</span>}</div>}<button className="sort-button" onClick={() => setOldest(!oldest)} title="Change queue sort order"><ArrowDownWideNarrow size={14}/>{oldest ? "Oldest first" : "Newest first"}</button></div>
      <div className="counter-queue-list">{requests.length ? requests.map((order) => <CounterOrderRow key={order.id} order={order}/>) : <div className="queue-empty"><QueueIllustration complete={tab === "completed"}/><span className="empty-eyebrow">{query || filter !== "all" ? "A CLEAR VIEW" : tab === "completed" ? "THE DAY IS JUST GETTING STARTED" : "READY WHEN YOU ARE"}</span><h3>{query || filter !== "all" ? "No requests match just yet." : tab === "completed" ? "Good picks are on the way." : "Your next pick starts here."}</h3><p>{query || filter !== "all" ? "Try a different search or view all requests." : tab === "completed" ? "Completed requests will appear here, with their timings and screenshots kept in history." : "Send a request from the counter and it’ll appear here and on your warehouse display. Instantly."}</p>{query || filter !== "all" ? <button className="text-button" onClick={() => { setQuery(""); setFilter("all"); }}>Show all requests <ArrowRight size={14}/></button> : <span className="empty-connected"><i className={connection === "connected" ? "online-dot" : "offline-dot"}/>{connection === "connected" ? "Warehouse connected and ready" : "Waiting for a live connection"}</span>}</div>}</div>
      <div className="queue-panel-footer"><span><Radio size={13}/>{connection === "connected" ? "Updates in real time" : "Waiting for connection"}</span><Link href="/history">View order history <ArrowUpRight size={13}/></Link></div></section><WorkflowStrip/></div></div>
  </>;
}
