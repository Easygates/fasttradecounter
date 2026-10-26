"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Download, ChevronLeft, ChevronRight, ImageIcon, SlidersHorizontal, CalendarDays, ArrowRight, Loader2, Clock3, X } from "lucide-react";
import { useWorkspace, fetchJson } from "@/components/workspace-provider";
import { StatusBadge } from "@/components/counter-page";
import { QueueIllustration } from "@/components/brand";
import { clockTime, duration, fullDate } from "@/lib/format";
import type { HistoryResult } from "@/lib/types";
function dateInput(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; }
export function HistoryPage() {
  const { snapshot, connection, now, openDetails, openScreenshot, notify } = useWorkspace();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("today");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState(dateInput(new Date()));
  const [to, setTo] = useState(dateInput(new Date()));
  const [page, setPage] = useState(1);
  const [data, setData] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => { const initialStatus = new URLSearchParams(location.search).get("status"); if (initialStatus && ["NEW","ACKNOWLEDGED","PICKING","COMPLETED"].includes(initialStatus)) setStatus(initialStatus); }, []);
  const todayKey = new Date(now).toDateString();
  const params = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), status, q:query });
    if (period !== "all") {
      let start = new Date(); start.setHours(0,0,0,0);
      let end = new Date(start); end.setDate(end.getDate()+1);
      if (period === "yesterday") { start.setDate(start.getDate()-1); end.setDate(end.getDate()-1); }
      if (period === "seven") start.setDate(start.getDate()-6);
      if (period === "custom") { start = new Date(`${from}T00:00:00`); end = new Date(`${to}T00:00:00`); end.setDate(end.getDate()+1); }
      if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) { params.set("from",start.toISOString()); params.set("to",end.toISOString()); }
    }
    return params.toString();
  }, [page,status,query,period,from,to,todayKey]);
  useEffect(() => {
    if (!snapshot) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      if (period === "custom" && (!from || !to || from > to)) { setError("Choose a valid start and end date."); setLoading(false); return; }
      void fetchJson<HistoryResult>(`/api/history?${params}`, { signal:abort.signal }).then((result) => {
        setData(result); const lastPage = Math.max(1, Math.ceil(result.total/result.pageSize)); if (page > lastPage) setPage(lastPage);
      }).catch((err) => { if (!abort.signal.aborted) setError(err.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [params,snapshot,period,from,to,page,retry]);
  async function exportCsv() {
    setExporting(true);
    try {
      const response = await fetch(`/api/history?${params}&export=1`);
      if (!response.ok) { const result = await response.json(); throw new Error(result.error); }
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href=url; anchor.download="picklane-order-history.csv"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),5000);
      notify("Order history exported. Exports include up to 10,000 matching requests.");
    } catch (err) { notify(err instanceof Error ? err.message : "Export failed. Please try again.","error"); }
    finally { setExporting(false); }
  }
  const total = data?.total || 0;
  return <><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> EVERY HANDOFF, ACCOUNTED FOR</div><h1>Order history<span className="heading-period">.</span></h1><p>A clear record of the work that keeps your operation moving.</p></div><button className="button open-display-button" onClick={() => void exportCsv()} disabled={exporting || connection !== "connected"}>{exporting ? <Loader2 size={17} className="spin"/> : <Download size={17}/>}Export CSV<ArrowRight size={16}/></button></div>
    <section className="panel history-panel"><div className="history-filters"><div className="history-period-row"><div className="period-tabs">{[{key:"today",label:"Today"},{key:"yesterday",label:"Yesterday"},{key:"seven",label:"Last 7 days"},{key:"all",label:"All time"},{key:"custom",label:"Custom range"}].map((item) => <button key={item.key} className={period === item.key ? "active" : ""} onClick={() => { setPeriod(item.key); setPage(1); }}>{item.key === "custom" && <CalendarDays size={14}/>} {item.label}</button>)}</div><span className="result-count">{total} {total === 1 ? "request" : "requests"}</span></div><div className="history-search-row"><div className="input-with-icon history-search"><Search size={17}/><input aria-label="Search history by order number" placeholder="Search by order number…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}/>{query && <button className="icon-button" aria-label="Clear search" onClick={() => setQuery("")}><X size={14}/></button>}</div><div className="status-filter"><SlidersHorizontal size={16}/><select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="ALL">All statuses</option><option value="NEW">New</option><option value="ACKNOWLEDGED">Acknowledged</option><option value="PICKING">Picking</option><option value="COMPLETED">Completed</option></select></div>{period === "custom" && <div className="custom-date-range"><input type="date" aria-label="Start date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }}/><ArrowRight size={14}/><input type="date" aria-label="End date" value={to} min={from} onChange={(e) => { setTo(e.target.value); setPage(1); }}/></div>}</div></div>
      {error ? <div className="table-error"><p>{error}</p><button className="button" onClick={() => setRetry((n)=>n+1)}>Try again</button></div> : <div className="history-table-wrap"><table className="history-table"><thead><tr><th>Order number</th><th>Message</th><th>Status</th><th>Submitted</th><th>Completed</th><th>Turnaround</th><th className="text-center">Image</th><th><span className="sr-only">Details</span></th></tr></thead><tbody>{loading && !data ? Array.from({length:5},(_,i)=><tr className="skeleton-row" key={i}>{Array.from({length:8},(_,j)=><td key={j}><span/></td>)}</tr>) : data?.requests.map((order)=><tr key={order.id}><td><button className="order-number-button" onClick={()=>openDetails(order)}>{order.orderNumber}</button><span className="table-date">{fullDate(order.createdAt)}</span></td><td className="table-message" title={order.message||""}>{order.message||<span className="muted">No message</span>}</td><td><StatusBadge status={order.status}/></td><td><span className="table-time">{clockTime(order.createdAt,true)}</span></td><td>{order.completedAt ? <><span className="table-time">{clockTime(order.completedAt,true)}</span><span className="table-date">{fullDate(order.completedAt)}</span></> : <span className="muted">—</span>}</td><td><span className="turnaround-cell"><Clock3 size={13}/>{order.completedAt ? duration(order.createdAt,order.completedAt) : duration(order.createdAt,now)}{!order.completedAt && <small>ongoing</small>}</span></td><td className="text-center">{order.screenshotPath ? <button className="icon-button history-image" aria-label={`View screenshot for ${order.orderNumber}`} onClick={()=>openScreenshot(order)}><ImageIcon size={18}/></button> : <span className="muted">—</span>}</td><td><button className="icon-button" aria-label={`View details for ${order.orderNumber}`} onClick={()=>openDetails(order)}><ChevronRight size={17}/></button></td></tr>)}</tbody></table>{!loading && !data?.requests.length && <div className="history-empty"><QueueIllustration complete/><span className="empty-eyebrow">A FRESH PERSPECTIVE</span><h3>No requests found.</h3><p>Try a different order number or widen your date range.</p><button className="text-button" onClick={()=>{setQuery("");setPeriod("all");setStatus("ALL");setPage(1);}}>View all requests <ArrowRight size={15}/></button></div>}</div>}
      <div className="history-pagination"><span>{total ? `${(page-1)*25+1}–${Math.min(page*25,total)} of ${total} requests` : "No requests to show"}{loading && data && <Loader2 size={13} className="spin"/>}</span><div><button className="button button-small" disabled={page<=1 || loading} onClick={()=>setPage(page-1)}><ChevronLeft size={15}/>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(total/25))}</span><button className="button button-small" disabled={page>=Math.ceil(total/25) || loading} onClick={()=>setPage(page+1)}>Next<ChevronRight size={15}/></button></div></div>
    </section><div className="history-note"><Clock3 size={16}/><span>Every status change is timestamped by the server. Open a request to see its full picking timeline.</span></div>
  </>;
}
