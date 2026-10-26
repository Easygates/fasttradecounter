"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Hash, ImagePlus, Upload, X, ArrowRight, ShieldCheck, CheckCircle2, Loader2, Scissors, ImageIcon, CircleAlert } from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";

export function RequestForm() {
  const { settings, connection, notify, refresh } = useWorkspace();
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const upload = useRef<HTMLInputElement>(null);
  const orderInput = useRef<HTMLInputElement>(null);
  const dropzone = useRef<HTMLDivElement>(null);
  const submissionKey = useRef("");
  const locked = useRef(false);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const attach = useCallback((file: File) => {
    if (locked.current) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setImageError("Use a PNG, JPEG, or WebP image. Try a new snip or attach an image file."); return; }
    if (file.size > settings.maxScreenshotMb * 1024 * 1024) { setImageError(`This image is too large. The limit is ${settings.maxScreenshotMb} MB.`); return; }
    if (!file.size) { setImageError("That image is empty. Try capturing a new screenshot."); return; }
    setImageError(""); setAttachment(file);
  }, [settings.maxScreenshotMb]);
  useEffect(() => {
    if (!attachment) { setPreview(""); return; }
    const url = URL.createObjectURL(attachment); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      const items = Array.from(event.clipboardData?.items || []);
      const image = items.find((item) => item.kind === "file" && item.type.startsWith("image/"));
      if (image) {
        event.preventDefault(); const file = image.getAsFile();
        if (file) attach(file); else setImageError("The browser couldn’t read that image. Use Attach screenshot instead.");
      } else if ((items.some((item) => item.kind === "file") || dropzone.current?.contains(document.activeElement)) && items.length) {
        setImageError("No supported image was found in your clipboard. Take a snip, then press Ctrl + V again.");
      }
    };
    window.addEventListener("paste", paste); return () => window.removeEventListener("paste", paste);
  }, [attach]);
  useEffect(() => () => { xhrRef.current?.abort(); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked.current) return;
    const number = orderNumber.trim();
    if (!/^[A-Za-z0-9-]{1,80}$/.test(number)) { setError("Enter an order number using letters, numbers, or hyphens."); orderInput.current?.focus(); return; }
    if (connection !== "connected") { setError("Wait for a live connection before sending. Your details will stay here."); return; }
    locked.current = true; setSending(true); setProgress(0); setError("");
    if (!submissionKey.current) submissionKey.current = crypto.randomUUID();
    const data = new FormData(); data.set("orderNumber", number); data.set("message", message); data.set("submissionKey", submissionKey.current);
    if (attachment) data.set("screenshot", attachment, attachment.name || "clipboard-screenshot.png");
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest(); xhrRef.current = xhr;
        xhr.open("POST", "/api/requests"); xhr.timeout = 90000; xhr.setRequestHeader("X-Requested-With", "picklane");
        xhr.upload.onprogress = (uploadEvent) => { if (uploadEvent.lengthComputable) setProgress(Math.round(uploadEvent.loaded / uploadEvent.total * 100)); };
        xhr.onload = () => {
          try { const response = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(); else { if (response.code === "IDEMPOTENCY_MISMATCH") submissionKey.current = ""; reject(new Error(response.error || "The warehouse has not confirmed this request. Try again.")); } }
          catch { reject(new Error("An unexpected server response was received. Your details are kept; retry safely.")); }
        };
        xhr.onerror = () => reject(new Error("Connection lost before confirmation. Your details and screenshot are kept; retry safely."));
        xhr.ontimeout = () => reject(new Error("Confirmation is taking too long. Your details are kept; retrying will not duplicate this request."));
        xhr.onabort = () => reject(new Error("The upload was interrupted. Please retry."));
        xhr.send(data);
      });
      setOrderNumber(""); setMessage(""); setAttachment(null); setImageError(""); submissionKey.current = "";
      notify(`Order ${number} sent to the warehouse${attachment ? " with its screenshot" : ""}.`);
      await refresh().catch(() => {});
      requestAnimationFrame(() => orderInput.current?.focus());
    } catch (err) { setError(err instanceof Error ? err.message : "This request could not be saved. Please retry."); }
    finally { setSending(false); locked.current = false; xhrRef.current = null; }
  }
  return <section className="panel request-panel"><div className="request-panel-heading"><span className="heading-icon"><Plus size={21}/></span><div><h2>New picking request</h2><p>A few details. Straight to the warehouse.</p></div><span className="new-request-label">NEW REQUEST</span></div>
    <form onSubmit={submit} noValidate className="request-form">
      <div className="form-field"><label htmlFor="order-number">Order number <span className="required-asterisk">*</span><span className="field-hint">Required</span></label><div className={`input-with-icon ${error && !orderNumber ? "invalid" : ""}`}><Hash size={18}/><input ref={orderInput} id="order-number" name="orderNumber" value={orderNumber} onChange={(event) => { setOrderNumber(event.target.value); if (error) setError(""); }} placeholder="e.g. SO-10428" maxLength={80} autoComplete="off" disabled={sending} required aria-describedby={error ? "submission-error" : undefined}/></div></div>
      <div className="form-field"><label htmlFor="request-message">Message <span className="field-hint">Optional</span></label><textarea id="request-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Anything the warehouse should know?" maxLength={1000} rows={2} disabled={sending}/><div className="message-suggestions">{["Customer waiting", "Urgent collection", "Check quantity"].map((text) => <button type="button" key={text} className={`suggestion-chip ${message.includes(text) ? "selected" : ""}`} disabled={sending} onClick={() => setMessage((previous) => previous.includes(text) ? previous.replace(text, "").replace(/^ · | · $/g, "") : `${previous}${previous ? " · " : ""}${text}`.slice(0,1000))}><Plus size={11}/>{text}</button>)}</div></div>
      <div className="form-field screenshot-field"><label>Screenshot <span className="field-hint">Optional</span>{attachment && <span className="attached-label"><CheckCircle2 size={12}/> Attached</span>}</label><div ref={dropzone} tabIndex={0} role="group" aria-label="Screenshot paste and upload area" className={`screenshot-dropzone ${dragging ? "dragging" : ""} ${attachment ? "has-image" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files[0]; if (file) attach(file); }}>
        {attachment && preview ? <div className="attachment-preview"><img src={preview} alt="Screenshot attachment preview" onError={() => { setImageError("This image preview could not be opened. Replace it with a valid PNG or JPEG."); }}/><div className="attachment-details"><span><ImageIcon size={15}/><b>{attachment.name || "Clipboard screenshot"}</b><small>{(attachment.size / 1024 / 1024).toFixed(2)} MB</small></span><div><button type="button" className="text-button" onClick={() => upload.current?.click()} disabled={sending}>Replace</button><button type="button" className="icon-button" aria-label="Remove screenshot" disabled={sending} onClick={() => { setAttachment(null); setImageError(""); }}><X size={16}/></button></div></div></div> : <><span className="snip-icon"><Scissors size={24}/><span className="snip-corner top-left"/><span className="snip-corner top-right"/><span className="snip-corner bottom-left"/><span className="snip-corner bottom-right"/></span><h3>Snip it. Paste it. That’s it.</h3><p>Take a screenshot with Win + Shift + S,<br/>then press Ctrl + V to paste it here.</p><div className="dropzone-or"><span/>or<span/></div><button type="button" className="button attach-button" onClick={() => upload.current?.click()} disabled={sending}><ImagePlus size={16}/> Attach screenshot</button><span className="upload-hint">PNG, JPG or WebP · up to {settings.maxScreenshotMb} MB</span></>}
      </div><input ref={upload} type="file" className="sr-only" aria-label="Upload screenshot" accept="image/png,image/jpeg,image/webp" disabled={sending} onChange={(event) => { const file = event.target.files?.[0]; if (file) attach(file); event.target.value = ""; }}/>{imageError && <div className="inline-error"><CircleAlert size={15}/><span>{imageError}</span></div>}</div>
      {error && <div id="submission-error" className="inline-error submission-error" role="alert"><CircleAlert size={17}/><span>{error}</span></div>}
      <button type="submit" className="button button-primary send-button" disabled={sending || connection !== "connected"}>{sending ? <><Loader2 size={18} className="spin"/>{progress >= 100 ? "Saving request…" : `Sending${attachment ? ` screenshot · ${progress}%` : " request…"}`}</> : <><Upload size={18}/><span>Send to warehouse</span><ArrowRight size={19}/></>}</button>
      {sending && <div className="upload-progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Request upload progress"><span style={{width:`${progress}%`}}/></div>}
      <p className="secure-caption"><ShieldCheck size={13}/> Private attachments. Instant handoff.</p>
    </form></section>;
}
