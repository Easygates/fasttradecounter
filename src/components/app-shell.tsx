"use client";
import Link from "next/link";
import { useState } from "react";
import { Store, Warehouse, History, Settings2, ArrowUpRight, RadioTower, CircleHelp, ChevronRight, Wifi, WifiOff, RefreshCw, ShieldCheck, X, Monitor, Scissors, Volume2, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Modal } from "@/components/viewers";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace-provider";
import { CounterPage } from "@/components/counter-page";
import { WarehousePage } from "@/components/warehouse-page";
import { HistoryPage } from "@/components/history-page";
import { SettingsPage } from "@/components/settings-page";
import { clockTime } from "@/lib/format";

export type View = "counter" | "warehouse" | "history" | "settings";
const titles = { counter: "Trade counter", warehouse: "Warehouse display", history: "Order history", settings: "Settings" };
export function ConnectionIndicator() {
  const { connection } = useWorkspace();
  return <span className={`connection-indicator ${connection}`} title={connection === "connected" ? "Live updates are connected" : "Displayed requests may be out of date"}><i />{connection === "connected" ? "Live connection" : connection === "connecting" ? "Connecting" : connection === "reconnecting" ? "Reconnecting" : "Offline"}</span>;
}
export function OperationsApp({ view }: { view: View }) {
  return <WorkspaceProvider workspace={view === "warehouse" ? "display" : "counter"} readOnly={view === "history" || view === "settings"}><AppShell view={view} /></WorkspaceProvider>;
}
function AppShell({ view }: { view: View }) {
  const { settings, now, connection, bootError, retry, snapshot } = useWorkspace();
  const [help, setHelp] = useState(false);
  const [tvMode, setTvMode] = useState(false);
  const warehouse = view === "warehouse";
  const date = new Date(now).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const nav = [
    { href: "/", label: "Trade counter", icon: Store, key: "counter" },
    { href: "/warehouse", label: "Warehouse display", icon: Warehouse, key: "warehouse" },
    { href: warehouse ? "/history?workspace=display" : "/history", label: "Order history", icon: History, key: "history" },
    ...(!warehouse ? [{ href: "/settings", label: "Settings", icon: Settings2, key: "settings" }] : []),
  ];
  return <div className={`app-shell ${warehouse ? "warehouse-theme" : ""} ${tvMode ? "tv-mode" : ""}`}>
    <aside className="sidebar"><Link href={warehouse ? "/warehouse" : "/"} className="brand" aria-label="Picklane home"><BrandMark /><div>picklane<span>COUNTER TO COLLECTION</span></div></Link><div className="sidebar-label">YOUR WORKSPACE</div><nav className="main-nav" aria-label="Main navigation">{nav.map((item) => <Link key={item.key} href={item.href} className={`nav-item ${view === item.key ? "active" : ""}`}><item.icon size={19} strokeWidth={1.7}/><span>{item.label}</span>{item.key === "warehouse" ? <span className="nav-live">LIVE</span> : item.key === "settings" ? <ShieldCheck size={13} className="nav-end"/> : view === item.key ? <ChevronRight size={15} className="nav-end"/> : null}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-connect-card"><span className="signal-icon"><RadioTower size={21}/></span><h3>Good teams stay in sync.</h3><p>A clear queue.<br/>A smoother working day.</p><div><i className={connection === "connected" ? "online-dot" : "offline-dot"}/>{connection === "connected" ? "All systems connected" : "Waiting for connection"}</div><svg viewBox="0 0 160 58" fill="none" aria-hidden="true"><path d="M1 42h18V29h18v13h18V16h18v26h18V7h18v35h18V22h18v20h15" stroke="currentColor" strokeWidth="1"/><path d="M1 51h159" stroke="currentColor" strokeWidth="1" strokeDasharray="3 5"/></svg></div><button className="help-link" onClick={() => setHelp(true)}><CircleHelp size={18}/><span>Help & quick guide</span><ArrowUpRight size={14}/></button><div className="workspace-identity"><span className="company-monogram">{settings.companyInitials}</span><div><strong>{warehouse ? "Warehouse display" : "Trade workspace"}</strong><span>{warehouse ? "Restricted device access" : "Your operation, connected"}</span></div><ShieldCheck size={15}/></div></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="business-heading"><span className="business-icon"><Store size={18}/></span><strong>{settings.companyName}</strong><span className="topbar-slash">/</span><span className="topbar-page">{titles[view]}</span></div><div className="topbar-right"><time suppressHydrationWarning>{date}<span className="time-separator"/> {clockTime(now, true)}</time><ConnectionIndicator/><button className="icon-button topbar-help" onClick={() => setHelp(true)} aria-label="Open quick guide"><CircleHelp size={18}/></button></div></header>
      <main className="page-content">
        {(connection === "offline" || connection === "reconnecting") && <div className="connection-warning" role="alert"><WifiOff size={19}/><div><strong>{bootError ? "Workspace access needs attention" : connection === "offline" ? "You’re offline. Your work is still here." : "Reconnecting to your warehouse…"}</strong><span>{bootError || "The queue may be out of date. Actions and audio alerts pause until the live connection is restored."}</span></div><button className="button button-small" onClick={retry}><RefreshCw size={14}/> Reconnect</button></div>}
        {view === "counter" && <CounterPage/>}{view === "warehouse" && <WarehousePage tvMode={tvMode} setTvMode={setTvMode}/>}{view === "history" && <HistoryPage/>}{view === "settings" && <SettingsPage/>}
        <footer className="page-footer"><span><BrandMark small/> Less chasing. More moving.</span><span><ShieldCheck size={13}/> {warehouse ? "Restricted warehouse session" : "Private & securely stored"}<span className="footer-divider"/><Wifi size={13}/>{connection === "connected" ? "All screens in sync" : snapshot ? "Showing last received data" : "Connecting your workspace"}</span></footer>
      </main>
    </div>
    {help && <Modal onClose={() => setHelp(false)} className="help-modal" labelledBy="help-title"><div className="modal-header"><div><span className="eyebrow">A QUICK HANDOFF</span><h2 id="help-title">Meet your connected workspace.</h2></div><button className="icon-button" onClick={() => setHelp(false)} aria-label="Close quick guide"><X size={22}/></button></div><div className="help-content"><div><span className="help-step"><Scissors size={22}/></span><section><h3>Snip. Paste. Send.</h3><p>Capture an order with <kbd>Win</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd>. Return to the trade counter and press <kbd>Ctrl</kbd> + <kbd>V</kbd>. Add the order number and send. Screenshots are optional.</p></section></div><div><span className="help-step"><Monitor size={22}/></span><section><h3>Give your warehouse a clear view.</h3><p>Open <strong>/warehouse</strong> on the warehouse computer. Use TV mode or F11 for full-screen, keep the computer awake, and leave the browser open.</p></section></div><div><span className="help-step"><Volume2 size={22}/></span><section><h3>One click to enable alerts.</h3><p>Click <strong>Enable sound</strong> on the warehouse display. New requests repeat a chime until acknowledged or completed. Browser sleep, suspension, or network outages can delay alerts; connection and sound warnings are always shown.</p></section></div><div className="help-note"><ShieldCheck size={18}/><span>Warehouse devices have restricted access. Administration requires a separate password. In production, use provisioned device links behind HTTPS.</span></div><Link href="/warehouse" className="button button-primary full-width" onClick={() => setHelp(false)}>Open warehouse display <ArrowRight size={17}/></Link></div></Modal>}
  </div>;
}
