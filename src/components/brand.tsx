import { ArrowRight, Check, ClipboardList, RadioTower, Warehouse } from "lucide-react";
export function BrandMark({ small = false }: { small?: boolean }) {
  return <span className={`brand-mark ${small ? "small-mark" : ""}`} aria-hidden="true"><svg viewBox="0 0 36 36" fill="none"><path d="m18 4 13 7.4L18 19 5 11.4 18 4Z" fill="currentColor"/><path d="m5 17 13 7.6L31 17v6.2L18 31 5 23.2V17Z" fill="currentColor"/></svg></span>;
}
export function QueueIllustration({ complete = false }: { complete?: boolean }) {
  return <svg className="queue-illustration" width="224" height="160" viewBox="0 0 224 160" fill="none" aria-hidden="true">
    <ellipse cx="111" cy="144" rx="91" ry="8" fill="#EEF3F0" />
    <path d="M24 142V35h85v107M28 79h77M28 121h77M33 35v107M101 35v107" stroke="#CBD8D1" strokeWidth="3" strokeLinecap="round" />
    <path d="M45 53h23v25H45V53Z" fill="#DFE8E2" stroke="#C6D4CB"/><path d="M54 53v8h6v-8" stroke="#B5C7BC"/>
    <path d="M73 61h19v17H73V61Z" fill="#D2E3D9" stroke="#B8CEC1"/>
    <path d="M42 92h31v28H42V92Z" fill="#E7EDE7" stroke="#C4D3C8"/><path d="M54 92v9h7v-9" stroke="#BECEC2"/>
    <path d="M80 102h14v18H80v-18Z" fill="#D1E1D6" stroke="#B7C9BD"/>
    <rect x="104" y="31" width="79" height="108" rx="9" fill="#DDEEE4"/>
    <rect x="110" y="35" width="79" height="108" rx="8" fill="#fff" stroke="#BFD9CA" strokeWidth="1.5"/>
    <rect x="130" y="27" width="39" height="14" rx="5" fill="#6A9A82"/>
    <rect x="141" y="26" width="17" height="5" rx="2.5" fill="#DDEEE4"/>
    <circle cx="149" cy="81" r="19" fill="#E3F2E9"/>
    {complete ? <path d="m140 81 6 6 13-13" stroke="#367A58" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/> : <><path d="M141 72h16v18h-16V72Z" stroke="#589172" strokeWidth="1.7" strokeLinejoin="round"/><path d="M145 71h8v4h-8z" fill="#E3F2E9" stroke="#589172" strokeWidth="1.4"/><path d="M145 80h8m-8 5h5" stroke="#589172" strokeWidth="1.6" strokeLinecap="round"/></>}
    <path d="M128 113h43M137 121h25" stroke="#D3E0D7" strokeWidth="3" strokeLinecap="round"/>
    <path d="M196 64h8m-4-4v8M14 96h8m-4-4v8" stroke="#A3C5B1" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="190" cy="21" r="3" fill="#D4E8DC"/><circle cx="20" cy="23" r="2" fill="#BFD4C6"/><path d="m191 126 4 4-4 4-4-4 4-4Z" fill="#B3D2BE"/>
  </svg>;
}
export function WorkflowStrip() {
  return <div className="workflow-strip"><div className="workflow-heading"><RadioTower size={19} /><div><strong>A better handoff. Every time.</strong><span>One shared queue. No calls, no chasing.</span></div><span className="workflow-label">HOW IT WORKS</span></div><div className="workflow-steps"><div><span className="step-icon"><ClipboardList size={17}/></span><span><b>01</b> Send a request</span></div><ArrowRight size={15}/><div><span className="step-icon"><Warehouse size={17}/></span><span><b>02</b> Warehouse picks</span></div><ArrowRight size={15}/><div><span className="step-icon"><Check size={17}/></span><span><b>03</b> Ready to go</span></div></div></div>;
}
