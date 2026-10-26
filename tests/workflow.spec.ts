import "dotenv/config";
import { test, expect, type BrowserContext } from "@playwright/test";
import sharp from "sharp";
import { and, ilike, inArray } from "drizzle-orm";
import { db, pool } from "../src/db";
import { pickingRequests, screenshots, orderStatusHistory } from "../src/db/schema";

const prefix = `E2E-${crypto.randomUUID().slice(0,8).toUpperCase()}-`;
const headers = { "X-Requested-With":"picklane" };
const fixtureSvg = `<svg width="1200" height="720" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="720" fill="white"/><rect width="1200" height="80" fill="#193f2b"/><text x="40" y="51" fill="white" font-size="28" font-family="sans-serif">TEST ORDER · SCREENSHOT FIXTURE</text><g font-family="sans-serif" fill="#253c2a"><text x="42" y="140" font-size="23">TRADE COLLECTION — 00042</text><text x="42" y="190" font-size="17">Product</text><text x="720" y="190" font-size="17">Location</text><text x="1040" y="190" font-size="17">Quantity</text><path d="M40 211h1110" stroke="#c8d8c8"/><text x="42" y="255" font-size="19">M12 galvanized fixings</text><text x="720" y="255" font-size="19">Aisle 04 · B12</text><text x="1050" y="255" font-size="19">24</text><text x="42" y="310" font-size="19">Heavy-duty shelf brackets</text><text x="720" y="310" font-size="19">Aisle 02 · C06</text><text x="1050" y="310" font-size="19">8</text><text x="42" y="390" font-size="14">Small text quality check: preserve all dimensions and readable order quantities.</text><text x="42" y="640" font-size="16">Automated acceptance fixture — not a customer order.</text></g></svg>`;
let image: Buffer;
test.beforeAll(async()=>{image=await sharp(Buffer.from(fixtureSvg)).png().toBuffer();});
test.afterAll(async()=>{
  const rows=await db.select({id:pickingRequests.id}).from(pickingRequests).where(ilike(pickingRequests.orderNumber,`${prefix}%`));
  const ids=rows.map((row)=>row.id);
  if(ids.length)await db.transaction(async(tx)=>{await tx.delete(orderStatusHistory).where(inArray(orderStatusHistory.pickingRequestId,ids));await tx.delete(screenshots).where(inArray(screenshots.pickingRequestId,ids));await tx.delete(pickingRequests).where(inArray(pickingRequests.id,ids));});
  await pool.end();
});
async function create(context:BrowserContext, number:string, message:string){const response=await context.request.post("/api/requests",{headers,multipart:{orderNumber:number,message,submissionKey:crypto.randomUUID()}});expect(response.status()).toBe(201);return(await response.json()).request;}
async function transition(context:BrowserContext,id:string,status:string,scope="display"){return context.request.patch(`/api/requests/${id}`,{headers:{...headers,"X-Picklane-Workspace":scope},data:{status}});}

test("persistent counter-to-warehouse workflow, live events, screenshots, alerts, security and recovery",async({browser})=>{
  const baseURL=process.env.TEST_BASE_URL||"http://127.0.0.1:3000";
  const counterContext=await browser.newContext({baseURL,viewport:{width:1440,height:900}});
  const displayContext=await browser.newContext({baseURL,viewport:{width:1920,height:1080}});
  await displayContext.addInitScript(()=>{
    const w=window as typeof window & {__toneCount:number};w.__toneCount=0;
    const original=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(this:AudioContext){const oscillator=original.call(this);const start=oscillator.start.bind(oscillator);oscillator.start=(when?:number)=>{w.__toneCount++;start(when);};return oscillator;};
  });
  const counter=await counterContext.newPage();const display=await displayContext.newPage();
  const browserErrors:string[]=[];counter.on("pageerror",err=>browserErrors.push(err.message));display.on("pageerror",err=>browserErrors.push(err.message));
  await test.step("connect independent login-free workspaces",async()=>{
    await Promise.all([counter.goto("/"),display.goto("/warehouse")]);
    await expect(counter.getByText("Live connection",{exact:true})).toBeVisible();await expect(display.getByText("Live connection",{exact:true})).toBeVisible();
    await expect(display.locator('input[type="password"]')).toHaveCount(0);
    const sendBounds=await counter.getByRole("button",{name:"Send to warehouse",exact:true}).boundingBox();expect(sendBounds!.y+sendBounds!.height).toBeLessThanOrEqual(900);await counter.screenshot({path:"artifacts/counter-empty.png",fullPage:true});await display.screenshot({path:"artifacts/warehouse-empty-1080p.png"});
  });
  await test.step("enable sound and use local alert settings",async()=>{
    await display.getByRole("button",{name:"Enable sound",exact:true}).first().click();await expect(display.getByRole("button",{name:"Sound on",exact:true})).toBeVisible();
    await display.getByRole("button",{name:"Display sound preferences"}).click();await display.getByLabel("Repeat interval (seconds)").fill("3");await display.getByRole("button",{name:"Done",exact:true}).click();
  });
  const number=`${prefix}00042`;
  let firstId="",secondId="",imageId="";
  await test.step("paste a browser clipboard image and submit atomically",async()=>{
    await counter.getByLabel("Order number",{exact:false}).fill(number);await counter.getByLabel("Message",{exact:false}).fill("Customer waiting — test attachment");
    await counter.evaluate((base64)=>{const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0));const file=new File([bytes],"snipping-tool.png",{type:"image/png"});const transfer=new DataTransfer();transfer.items.add(file);window.dispatchEvent(new ClipboardEvent("paste",{clipboardData:transfer,bubbles:true,cancelable:true}));},image.toString("base64"));
    await expect(counter.getByAltText("Screenshot attachment preview")).toBeVisible();
    const saved=counter.waitForResponse(response=>response.url().endsWith("/api/requests")&&response.request().method()==="POST");
    await counter.getByRole("button",{name:"Send to warehouse",exact:true}).click();const response=await saved;expect(response.status()).toBe(201);const result=await response.json();firstId=result.request.id;imageId=result.request.screenshotPath;
    await expect(counter.getByLabel("Order number",{exact:false})).toHaveValue("");await expect(counter.getByAltText("Screenshot attachment preview")).toHaveCount(0);
    await expect(display.locator(".warehouse-order-card").filter({hasText:"Customer waiting — test attachment"})).toBeVisible();
  });
  const firstCard=display.locator(".warehouse-order-card").filter({hasText:"Customer waiting — test attachment"});
  await test.step("open private screenshot, zoom, and leave status unchanged",async()=>{
    await firstCard.getByRole("button",{name:/View screenshot/}).click();await expect(display.getByAltText(`Order ${number} screenshot`)).toBeVisible();
    await display.getByRole("button",{name:"Zoom in",exact:true}).click();await display.getByRole("button",{name:"Zoom in",exact:true}).click();await display.getByRole("button",{name:"Zoom in",exact:true}).click();await expect(display.getByText("150%",{exact:true})).toBeVisible();
    await display.getByRole("button",{name:"Close screenshot",exact:true}).click();await expect(firstCard.locator(".status-badge")).toHaveText("New");
    const privateResponse=await displayContext.request.get(`/api/screenshots/${imageId}`);expect(privateResponse.status()).toBe(200);expect(privateResponse.headers()["cache-control"]).toContain("private");
  });
  await test.step("new requests repeat sound and duplicate order numbers remain separate",async()=>{
    const before=await display.evaluate(()=>(window as typeof window & {__toneCount:number}).__toneCount);await expect.poll(()=>display.evaluate(()=>(window as typeof window & {__toneCount:number}).__toneCount),{timeout:6500}).toBeGreaterThan(before);
    const second=await create(counterContext,number,"Second separate picking request");secondId=second.id;expect(secondId).not.toBe(firstId);
    await expect(display.locator(".warehouse-order-card").filter({hasText:number})).toHaveCount(2);
    await firstCard.getByRole("button",{name:"Acknowledge request",exact:true}).click();await expect(firstCard.locator(".status-badge")).toHaveText("Acknowledged");
    const afterAck=await display.evaluate(()=>(window as typeof window & {__toneCount:number}).__toneCount);await expect.poll(()=>display.evaluate(()=>(window as typeof window & {__toneCount:number}).__toneCount),{timeout:6500}).toBeGreaterThan(afterAck);
    await firstCard.getByRole("button",{name:"Start picking",exact:true}).click();await expect(firstCard.locator(".status-badge")).toHaveText("Picking");
  });
  await test.step("counter completion stops the last alert and warehouse completion synchronizes",async()=>{
    const row=counter.locator(".counter-order-row").filter({hasText:"Second separate picking request"});await expect(row).toBeVisible();await row.getByRole("button",{name:"Complete",exact:true}).click();
    await expect(display.locator(".warehouse-order-card").filter({hasText:"Second separate picking request"})).toHaveCount(0);
    await display.waitForTimeout(900);const stopped=await display.evaluate(()=>(window as typeof window & {__toneCount:number}).__toneCount);await display.waitForTimeout(3600);expect(await display.evaluate(()=>(window as typeof window & {__toneCount:number}).__toneCount)).toBe(stopped);
    await firstCard.getByRole("button",{name:"Mark completed",exact:true}).click();await expect(firstCard).toHaveCount(0);await expect(counter.locator(".counter-order-row").filter({hasText:"Customer waiting — test attachment"})).toHaveCount(0);
    const detail=await(await counterContext.request.get(`/api/requests/${firstId}`)).json();expect(detail.history.map((event:{newStatus:string})=>event.newStatus)).toEqual(["NEW","ACKNOWLEDGED","PICKING","COMPLETED"]);
    await Promise.all([counter.reload(),display.reload()]);await expect(counter.getByText("Live connection",{exact:true})).toBeVisible();await expect(display.getByText("Live connection",{exact:true})).toBeVisible();
    const snapshot=await(await counterContext.request.get("/api/requests")).json();expect(snapshot.requests.find((r:{id:string})=>r.id===firstId).status).toBe("COMPLETED");expect((await displayContext.request.get(`/api/screenshots/${imageId}`)).status()).toBe(200);
  });
  await test.step("recover missed orders after a real browser network disconnection",async()=>{
    await displayContext.setOffline(true);await expect(display.locator(".connection-warning")).toBeVisible();
    const missed=await create(counterContext,`${prefix}RECONNECT`,"Created while display was offline");await expect(display.locator(".warehouse-order-card").filter({hasText:missed.orderNumber})).toHaveCount(0);
    await displayContext.setOffline(false);await expect(display.getByText("Live connection",{exact:true})).toBeVisible();await expect(display.locator(".warehouse-order-card").filter({hasText:missed.orderNumber})).toBeVisible();
    const race=await Promise.all([transition(displayContext,missed.id,"ACKNOWLEDGED"),transition(counterContext,missed.id,"COMPLETED","counter")]);expect(race[1].status()).toBe(200);expect([200,409]).toContain(race[0].status());
    expect((await transition(displayContext,missed.id,"PICKING")).status()).toBe(409);const final=await(await counterContext.request.get(`/api/requests/${missed.id}`)).json();expect(final.request.status).toBe("COMPLETED");
  });
  await test.step("reject anonymous, cross-site, display-create, and display-admin access",async()=>{
    const anonymous=await browser.newContext({baseURL});expect((await anonymous.request.get("/api/requests")).status()).toBe(401);expect((await anonymous.request.get(`/api/screenshots/${imageId}`)).status()).toBe(401);
    expect((await displayContext.request.post("/api/requests",{headers,multipart:{orderNumber:`${prefix}FORBIDDEN`,submissionKey:crypto.randomUUID()}})).status()).toBe(401);
    expect((await displayContext.request.put("/api/settings",{headers,data:{companyName:"Forbidden"}})).status()).toBe(401);
    expect((await counterContext.request.patch(`/api/requests/${firstId}`,{headers:{...headers,Origin:"https://untrusted.example"},data:{status:"COMPLETED"}})).status()).toBe(403);await anonymous.close();
  });
  let retryId="";
  await test.step("failed uploads preserve details and image, then retry successfully",async()=>{
    await counter.getByLabel("Order number",{exact:false}).fill(`${prefix}RETRY`);await counter.getByLabel("Message",{exact:false}).fill("Keep these details through a failed upload");
    await counter.locator('input[type="file"]').setInputFiles({name:"order.png",mimeType:"image/png",buffer:image});await expect(counter.getByAltText("Screenshot attachment preview")).toBeVisible();
    await counter.route("**/api/requests",async route=>{if(route.request().method()==="POST")await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Test upload failure: retry with your preserved details."})});else await route.continue();});
    await counter.getByRole("button",{name:"Send to warehouse",exact:true}).click();await expect(counter.getByText("Test upload failure: retry with your preserved details.",{exact:true})).toBeVisible();await expect(counter.getByLabel("Order number",{exact:false})).toHaveValue(`${prefix}RETRY`);await expect(counter.getByLabel("Message",{exact:false})).toHaveValue("Keep these details through a failed upload");await expect(counter.getByAltText("Screenshot attachment preview")).toBeVisible();await counter.unroute("**/api/requests");
    const saved=counter.waitForResponse(response=>response.url().endsWith("/api/requests")&&response.request().method()==="POST");await counter.getByRole("button",{name:"Send to warehouse",exact:true}).click();const response=await saved;expect(response.status()).toBe(201);retryId=(await response.json()).request.id;expect((await transition(counterContext,retryId,"COMPLETED","counter")).status()).toBe(200);
  });
  await test.step("history searches, preserves attachments, and exports CSV",async()=>{
    await counter.goto("/history");await expect(counter.getByText("Live connection",{exact:true})).toBeVisible();await counter.getByLabel("Search history by order number").fill(prefix);await counter.getByLabel("Filter by status").selectOption("COMPLETED");await expect(counter.locator(".history-table tbody tr")).toHaveCount(4);await expect(counter.locator(".history-table tbody tr").first()).toBeVisible();
    const download=counter.waitForEvent("download");await counter.getByRole("button",{name:"Export CSV",exact:true}).click();expect((await download).suggestedFilename()).toBe("picklane-order-history.csv");
  });
  await test.step("readable operational queue at 1080p and 4K without horizontal scroll",async()=>{
    const tvNew=await create(counterContext,`${prefix}TV-NEW`,"Customer waiting at the trade counter");const tvAck=await create(counterContext,`${prefix}TV-ACK`,"Collection booked for this afternoon");const tvPick=await create(counterContext,`${prefix}TV-PICK`,"Check quantities before collection");
    await transition(displayContext,tvAck.id,"ACKNOWLEDGED");await transition(displayContext,tvPick.id,"ACKNOWLEDGED");await transition(displayContext,tvPick.id,"PICKING");
    await expect(display.locator(".warehouse-order-card")).toHaveCount(3);await expect(display.locator(".warehouse-lane.picking .warehouse-order-card")).toHaveCount(1);await expect(display.locator(".warehouse-lane.acknowledged .warehouse-order-card")).toHaveCount(1);await display.waitForTimeout(500);await display.screenshot({path:"artifacts/warehouse-active-1080p.png",fullPage:true});
    expect(await display.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await display.setViewportSize({width:3840,height:2160});await display.screenshot({path:"artifacts/warehouse-active-4k.png",fullPage:true});expect(await display.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(await display.locator(".warehouse-order-number").first().evaluate(element=>parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(50);
    await counter.goto("/");await expect(counter.getByText("Live connection",{exact:true})).toBeVisible();await counter.screenshot({path:"artifacts/counter-active.png",fullPage:true});
    for(const row of [tvNew,tvAck,tvPick])expect((await transition(counterContext,row.id,"COMPLETED","counter")).status()).toBe(200);
  });
  await test.step("recover a failed snapshot while the event stream remains open",async()=>{
    let failOnce=true;
    const pattern=/\/api\/requests\?tz=/;
    await counter.route(pattern,async route=>{if(failOnce){failOnce=false;await route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({error:"Temporary snapshot interruption"})});}else await route.continue();});
    const row=await create(counterContext,`${prefix}SNAPSHOT`,"Snapshot recovery verification");
    await expect(counter.locator(".connection-warning")).toBeVisible();await expect(counter.getByText("Live connection",{exact:true})).toBeVisible();await expect(counter.locator(".counter-order-row").filter({hasText:row.orderNumber})).toBeVisible();await counter.unroute(pattern);
    expect((await transition(counterContext,row.id,"COMPLETED","counter")).status()).toBe(200);
  });
  await test.step("idempotency keys prevent repeated submissions and malformed images are rejected",async()=>{
    const submissionKey=crypto.randomUUID();const payload={orderNumber:`${prefix}IDEMPOTENT`,message:"Double-submit verification",submissionKey};
    const results=await Promise.all([counterContext.request.post("/api/requests",{headers,multipart:payload}),counterContext.request.post("/api/requests",{headers,multipart:payload})]);
    expect(results.map(r=>r.status()).sort()).toEqual([200,201]);const records=await Promise.all(results.map(r=>r.json()));expect(records[0].request.id).toBe(records[1].request.id);await transition(counterContext,records[0].request.id,"COMPLETED","counter");
    const invalid=await counterContext.request.post("/api/requests",{headers,multipart:{orderNumber:`${prefix}INVALID`,submissionKey:crypto.randomUUID(),screenshot:{name:"not-really.png",mimeType:"image/png",buffer:Buffer.from("not an image")}}});expect(invalid.status()).toBe(422);
  });
  if(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.length>=12)await test.step("unlock real administrator settings and broadcast protected configuration changes",async()=>{
    const adminContext=await browser.newContext({baseURL,viewport:{width:1440,height:1000}});const admin=await adminContext.newPage();await admin.goto("/settings");await admin.getByLabel("Administrator password",{exact:true}).fill(process.env.ADMIN_PASSWORD!);await admin.getByRole("button",{name:"Unlock settings",exact:true}).click();await expect(admin.getByLabel("Company name",{exact:true})).toBeVisible();
    const previous=await admin.getByLabel("Company name",{exact:true}).inputValue();
    try{
      await admin.getByLabel("Company name",{exact:true}).fill("Picklane acceptance workspace");await admin.getByRole("button",{name:"Save settings",exact:true}).click();await expect(counter.locator(".business-heading strong")).toHaveText("Picklane acceptance workspace");await expect(display.locator(".business-heading strong")).toHaveText("Picklane acceptance workspace");
      await admin.getByRole("button",{name:"Alerts & sound",exact:true}).click();await expect(admin.getByLabel("Repeat interval (seconds)",{exact:true})).toHaveValue("8");await admin.getByRole("button",{name:"Access & storage",exact:true}).click();await expect(admin.getByLabel("Maximum screenshot size (MB)")).toHaveValue("10");
    }finally{
      await admin.getByRole("button",{name:"General",exact:true}).click();await admin.getByLabel("Company name",{exact:true}).fill(previous);await admin.getByRole("button",{name:"Save settings",exact:true}).click();await expect(counter.locator(".business-heading strong")).toHaveText(previous);
    }
    await admin.getByRole("button",{name:"Lock settings",exact:true}).click();await expect(admin.getByRole("button",{name:"Unlock settings",exact:true})).toBeVisible();await adminContext.close();
  });
  expect(browserErrors).toEqual([]);
  await counterContext.close();await displayContext.close();
});
