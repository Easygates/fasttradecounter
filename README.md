# Picklane

A real, single-business trade-counter and warehouse picking application. Built with Next.js App Router, TypeScript, PostgreSQL, Drizzle, and standard browser APIs. No external SaaS, public storage bucket, or service-role browser key is required. The workspace starts empty; there are no fabricated live orders.

## What works

- `/` — trade counter: order numbers stored as text, optional messages, quick-message chips, clipboard image paste, file upload, previews, upload progress, and active/completed requests.
- `/warehouse` — direct, login-free warehouse queue with scoped device access, NEW → ACKNOWLEDGED → PICKING → COMPLETED actions, independent acknowledgement, one repeating chime, local audio controls, full-screen TV mode, and recently completed orders.
- `/history` — date/status/order-number filters, custom dates, pagination, server-timestamped timelines, original-resolution screenshots, and CSV export (up to 10,000 matching records).
- `/settings` — password-protected company branding, shared audio defaults, upload size and retention settings. No default administrator password.
- Immediate updates use **SSE + PostgreSQL LISTEN/NOTIFY**, not order polling. Notifications are emitted inside each transaction and delivered only after commit. Reconnection subscribes before fetching a fresh database snapshot, recovering missed orders.
- Screenshots live in **private PostgreSQL bytea storage**, outside the web root. This is persistent private binary storage, not a simulated upload or public URL. Backing up PostgreSQL preserves orders and images together.

## Local development

Prerequisites: Node.js 22+, npm, PostgreSQL 15+.

1. Install dependencies: `npm ci`.
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`.
3. On a **new, empty database**, run `npx drizzle-kit migrate`. The committed SQL migration is in `drizzle/`.
4. Run `npm run dev` and open `http://localhost:3000`.
5. Open `/warehouse` in another tab or browser. Click **Enable sound** there.

The hosted installation has a unique, generated administrator password in its private `.env` if one was not already configured. An authorised server operator can retrieve or replace `ADMIN_PASSWORD` there; it is never published in the UI or browser bundle. New deployments use their own environment configuration.

In the hosted development sandbox the local database has already been bootstrapped and the schema applied with `drizzle-kit push`. Do **not** apply the initial migration over an existing push-managed schema: use `npx drizzle-kit push` for that existing sandbox. Use the committed migration for fresh production databases. Never run destructive schema pushes against live business data without a backup and review.

`drizzle.config.ts` reads the database URL from the environment. No production database address is hardcoded.

## Environment and security

All secrets are server-side. See `.env.example` for every supported variable.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required PostgreSQL connection. Use TLS to a remote database. |
| `ACCESS_MODE` | `trusted-network` for a firewall-protected internal LAN; `provisioned` for production/internet-facing instances. |
| `COUNTER_ACCESS_TOKEN` | Random, distinct capability used once to enroll a counter device. |
| `WAREHOUSE_ACCESS_TOKEN` | Separate random capability used once to enroll a restricted warehouse display. |
| `ADMIN_PASSWORD` | Required only for Settings. Set a unique password of at least 12 characters. No fallback/default password. |
| `SESSION_SECRET` | Optional >=32-character random signing secret. If omitted, a random persistent server-only secret is generated in the database. Preserve it with backups. |
| `RETENTION_CRON_TOKEN` | Optional bearer secret for scheduled image cleanup. |
| `POSTGRES_PASSWORD` | Docker Compose database password; use URL-safe random hex. |
| `TEST_BASE_URL` | Optional already-running server URL for Playwright. Defaults to localhost:3000. |

Generate **different** values with `openssl rand -hex 32`. Do not reuse the database password for administrator or device access.

### Login-free, restricted device provisioning

For production set `ACCESS_MODE=provisioned`, BOTH workspace access tokens, and `ADMIN_PASSWORD`. Setting either workspace token also enables provisioned mode automatically; missing tokens then fail closed.

Provision a counter once at `https://your-domain/?access=YOUR_COUNTER_ACCESS_TOKEN`.

Provision the warehouse once at `https://your-domain/warehouse?access=YOUR_WAREHOUSE_ACCESS_TOKEN`.

The application exchanges the enrollment capability for a signed, HttpOnly, SameSite=Strict device cookie (Secure over HTTPS), removes the token from browser history, and sends no-referrer headers. Then bookmark the **clean** `/warehouse` URL. Warehouse employees enter no username/password and do not select a user. Device sessions last 30 days; renew with the provisioning URL after expiry. Browser refreshes do not lose orders or the device session.

Switching between trusted-network and provisioned mode automatically invalidates the previous mode’s signed cookies. Rotate `SESSION_SECRET` and restart all application instances to revoke all existing device/admin sessions; rotate enrollment tokens as well if an access link has leaked. Merely rotating an enrollment token does not revoke already-issued, unexpired sessions.

The warehouse capability permits queue/history/screenshot reads, acknowledgement, picking, and completion only. It cannot create picking requests or modify settings. Counter capabilities permit creation and completion, not warehouse picking actions. All checks happen on API routes. Administrator elevation is a separate one-hour signed cookie. Screenshots require an authorised device session on every access and are served private/no-store. There are no ordinary delete or reopen endpoints.

**Important:** the default sandbox/local mode is `trusted-network`, allowing login-free enrollment for devices that can reach the server. It is operationally convenient but is NOT an internet access boundary. Keep it behind a firewall or switch to provisioned mode before exposing it publicly. Use HTTPS; otherwise transport and non-Secure cookies are not protected in transit. Access-link tokens are bearer secrets: do not email them broadly, and redact query strings in reverse-proxy access logs. Terminate TLS only at a trusted proxy and strip untrusted forwarded headers.

Mutating APIs reject cross-site origins, require scoped cookies, validate inputs, apply per-process abuse limits, and use parameterized Drizzle queries. Use a reverse-proxy rate limiter for a multi-instance internet deployment. Database access should use a least-privilege application role; migrations should run with a separate schema-owner role. Apply database/disk encryption and encrypted backups for at-rest protection.

## Data correctness

`picking_requests`, `order_status_history`, `application_settings`, `application_secrets`, and `private_screenshots` are defined in `src/db/schema.ts` with UUIDs, foreign keys, checks, and indexes.

- Order numbers accept letters, digits, hyphens, and leading zeros. They are not unique; duplicate numbers create separate UUID requests.
- The client keeps a UUID idempotency key through retries. A request, image, and initial history event commit atomically. Only confirmed success clears the form. Double-clicks and safe retries do not create duplicate submissions.
- Transitions take a PostgreSQL row lock, validate the current state, update server timestamps, append history, and publish a notification in the same transaction. A completed request cannot be reopened by a late acknowledgement/picking action.
- NEW can be completed directly from either workspace. Acknowledgement and completion stop its alert. Acknowledging one order does not silence another NEW order.
- Snapshots use a read-only repeatable-read transaction so counts and queue membership cannot contradict each other during concurrent changes.
- The browser uses server time for waiting durations. Day counts are calculated using the display’s local timezone offset; history boundaries use local calendar dates.

## Screenshots and Windows Snipping Tool

1. Open the relevant order in the business system.
2. Press **Win + Shift + S** and select the required area.
3. Return to Picklane’s trade counter and press **Ctrl + V**.
4. A standard browser `paste` event supplies the image. The preview appears immediately. No automatic screen capture, clipboard background reading, connector, or special Snipping Tool API exists.
5. Enter the order number and optional message, then **Send to warehouse**.

PNG, JPEG and WebP are accepted. The default upload limit is 10 MB (configurable 1–20 MB). MIME type and actual decoded contents are checked with Sharp, animated images are rejected, a 40-megapixel pixel limit prevents decompression bombs, and images are normalized to lossless PNG at the original dimensions while removing metadata. Exceptionally large decoded images (>40 MB) are rejected safely. An authenticated modal supports fit, 25–400% zoom, and scrolling/panning. It never changes order status. Clipboard permissions are not requested because explicit user paste is the only clipboard-read action.

Invalid formats, oversize images, network failures and failed uploads show errors without clearing the order/message/selected image. If the response to a successful submission is lost, retry with the preserved idempotency key. If details were edited after an uncertain response and the earlier order was saved, the app warns before allowing a separate request.

## Alerts and connection handling

Audio uses the Web Audio API and locally generated chimes, so there is no external sound dependency. Browser autoplay restrictions are respected. **Enable sound must be clicked after opening/reloading the display.** The header says Sound on only when the AudioContext is running, alerts are enabled, and volume is nonzero. Audio suspension or browser permission failure is visibly warned about.

Shared defaults: sound enabled, clear chime, 65% volume, 8-second repeat, no maximum duration. Per-display preferences use localStorage only for sound preferences—not order persistence. A maximum duration is measured from the request’s server creation time; expired alerts remain NEW and visibly flagged. Acknowledgement/completion always stop the relevant alert regardless of duration. One chime cycle is managed for all unacknowledged requests; there are no overlapping per-order alarm loops.

The UI distinguishes Connected, Connecting, Reconnecting and Offline. Heartbeats monitor the stream. Lost connections trigger automatic reconnection and a full snapshot reconciliation. Order actions and repeating audio pause while data is stale. Pasted draft data stays on screen after recoverable failures; unsent drafts are not persisted across tab closure or deliberate page reload. Submitted orders and screenshots persist across refreshes/server restarts.

## Screenshot retention

Default: 90 days from image creation. Expired images are denied immediately by the screenshot route. Activity triggers physical cleanup at most hourly per server process, clears the attachment reference, and notifies connected screens. Order records/messages/history are never purged by this policy.

For cleanup during inactive periods, schedule an hourly POST to `/api/maintenance` with `Authorization: Bearer YOUR_RETENTION_CRON_TOKEN`. For example use cron plus `curl -fsS -X POST -H "Authorization: Bearer $RETENTION_CRON_TOKEN" https://your-domain/api/maintenance`. Without a valid bearer secret this endpoint requires a same-origin administrator session. Configure the scheduler yourself; the app does not falsely claim an external cron service is connected. Retention is not a substitute for backup retention; ensure expired sensitive images also age out of backups according to your policy.

## Production deployment

Use a persistent Node.js server/container and PostgreSQL. A VM or long-running container is recommended for the SSE/PostgreSQL listener; do not deploy this unchanged to a static host or an edge-only runtime. With multiple Node instances each process subscribes to PostgreSQL notifications, so changes propagate across instances without in-memory-only realtime.

### Docker Compose (new database)

1. Copy `.env.example` to `.env`. Set `POSTGRES_PASSWORD` to strong URL-safe hex, configure both access tokens, a strong `ADMIN_PASSWORD`, and optionally `SESSION_SECRET`/`RETENTION_CRON_TOKEN`.
2. Run `docker compose up --build -d`. Compose enforces provisioned mode, initializes PostgreSQL on a persistent volume, runs the committed migration, then starts the app. The web port is bound to localhost for a TLS reverse proxy; PostgreSQL is not exposed to the host network.
3. Put a TLS reverse proxy in front of `127.0.0.1:3000`. Configure the public hostname and provision the devices using the secure URLs above.
4. Verify `/api/health` returns `{ "ok": true }`. This endpoint tests database connectivity, not application authorization.

For direct Node deployment: `npm ci`, configure environment, apply `npx drizzle-kit migrate` to a fresh database, run `npm run build`, and supervise `npm run start` with your process manager. Run migrations only once per release. Store environment secrets outside the repository and perform rolling updates with healthy instances.

### Reverse proxy requirements

For the `/api/events` location disable response buffering/caching, use HTTP/1.1, keep read timeouts >=60 seconds (3600 recommended), and pass the original Host and X-Forwarded-Proto from a trusted proxy. Heartbeats arrive every 15 seconds. Set `client_max_body_size 22m` (or an equivalent limit above the configured image maximum). Do not cache private APIs/screenshots or strip Set-Cookie headers. Enable a suitable TLS/HSTS policy at the proxy. The app sends CSP, no-sniff, no-referrer, frame-denial, and device-permission headers.

Monitor process health, database availability/disk usage, SSE disconnect rates, and backups. PostgreSQL bytea storage makes this deployment self-contained; for exceptionally high image volumes, plan database capacity and backup bandwidth accordingly rather than assuming an unconfigured cloud bucket is in use.

## Warehouse computer setup

1. Use up-to-date **Chrome or Edge** on Windows and a wired network where practical.
2. Connect the TV/monitor and set 1920×1080 or 3840×2160 at 100% browser zoom. The warehouse layout scales typography at 4K, avoids horizontal queue scrolling, and supports TV mode.
3. Provision the warehouse device once, then bookmark/open its clean dedicated `/warehouse` URL on startup. Use **TV mode**, browser **F11**, or an OS-managed kiosk profile. Standard browser fullscreen must be initiated by a user click.
4. Click **Enable sound**. Check the header says **Sound on**, test the chime, and verify the OS mixer/output device and physical speakers. Do not mute the tab/site. Reloading requires enabling audio again.
5. In Windows Power & Battery settings keep the computer awake during working hours. Configure display sleep as operationally appropriate. Disable browser sleeping tabs/efficiency mode for this site, add it to Chrome/Edge’s always-active exceptions, and avoid automatic tab discard where device policy permits.
6. Keep the browser open. A daily opening check should confirm **Live connection** and **Sound on**, inspect NEW requests, and test a real counter-to-floor handoff.

A browser app cannot guarantee alerts while the OS is asleep, the tab/browser is suspended or closed, the network is down, or speakers are disconnected. Sleep/resume and outages can delay sound. The app warns about connection/audio state, pauses stale alerts, and reconciles all server orders after reconnection. It does not silently pretend stale data is live. For critical operational SLAs, combine this display with staff procedures and infrastructure monitoring; do not rely on unattended browser audio alone.

## Validation and tests

Run against a disposable/test workspace, not a busy live business database:

- `npx next typegen`
- `npm exec tsc -- --noEmit --pretty false`
- `npm run build`
- Start a production server through your normal deployment/runtime.
- `npx playwright install chromium`
- `npx playwright test`

The Playwright suite uses independent browser sessions, real PostgreSQL writes, real SSE, standard paste events with generated PNG fixtures, private image retrieval/zoom, real Web Audio scheduling instrumentation, refresh/reconnect, concurrent transitions, duplicate order numbers, CSV export, upload-failure preservation, and 1080p/4K viewport checks. It removes ONLY its uniquely prefixed temporary records directly through the database in teardown; no public delete endpoint is added. Visual artifacts are written under `artifacts/`.

Physical Win+Shift+S capture, audible speaker output, a real Windows sleep/wake cycle, actual TV distance readability, and power/network reliability require the manual acceptance checklist in `docs/ACCEPTANCE.md`. Automated tests do not claim to validate physical speakers or operating-system screenshot tools.
