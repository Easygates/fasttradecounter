# Picklane — complete local setup (including PostgreSQL + `git pull`)

**Short answers**

- **Is it local-only?** Yes, by design. No cloud account, SaaS, or external
  storage is needed. One always-on PC runs the Next.js server + PostgreSQL;
  counter and warehouse PCs only open it in Chrome/Edge. Orders and
  screenshots live in PostgreSQL on that PC. Only expose it to the internet
  if you follow the production section of `README.md` (not this file).
- **Is there a preview/demo?** There is no hosted public demo. "Preview" =
  you running it at `http://localhost:3000` — follow one path below and you
  have a full working copy (screens: `/`, `/warehouse`, `/history`,
  `/settings`, health check at `/api/health`).
- **Do I have to install PostgreSQL myself?** Only in Path C. Paths A and B
  run PostgreSQL 17 inside Docker for you — nothing to install or manage.

```
  Counter browser ─┐                          ┌─ PostgreSQL :5432
                    ├─►  http://<server-PC>:3000  (Next.js) ─┤   orders + history
  Warehouse TV ────┘     same PC = localhost:3000             └─ screenshots (bytea)
```

## Choose a path

| | A — Docker for everything ⭐ | B — Docker DB + local Node | C — No Docker |
| --- | --- | --- | --- |
| Install on server PC | Git + Docker Desktop | Git + Docker Desktop + Node 22+ | Git + Node 22+ + PostgreSQL 15+ |
| PostgreSQL install | None (container) | None (container) | Manual (see below) |
| Best for | Just running it daily | Editing code (`npm run dev`) | PCs where Docker is not allowed |
| Daily start | Docker Desktop starts it | One `npm` command | PG service + one `npm` command |

All paths: Windows commands are shown for **PowerShell**. On macOS/Linux the
same `git` / `npm` / `docker` commands work; only the installers in step 0
and `ipconfig` (use `ip addr` / `ifconfig`) differ.

## 0. Install the prerequisites (once, on the server PC)

Windows (run in PowerShell, then **open a new PowerShell window** so PATH
refreshes):

```powershell
winget install Git.Git              # or download from https://git-scm.com
winget install OpenJS.NodeJS.LTS    # Path B/C only — Node 22 or newer
# Path A/B only: Docker Desktop from https://www.docker.com/products/docker-desktop
# (install, reboot if asked, launch it and wait for "Engine running")
```

Verify (every line must print a version, no errors):

```powershell
git --version
node -v          # Path B/C — must be v22.x or newer
npm -v           # Path B/C
docker --version         # Path A/B
docker compose version   # Path A/B
```

macOS: `brew install git node@22` and Docker Desktop from docker.com.
Linux: install `git`, Node 22+ (e.g. via NodeSource/nvm) and Docker Engine
+ Compose plugin from docs.docker.com.

## 1. Pull the code (first time)

> Use `git clone`, **not** the GitHub ZIP download. A ZIP has no `.git`
> folder, so `git pull` updates later will not work.

```powershell
cd $HOME
git clone https://github.com/Easygates/fasttradecounter.git
cd fasttradecounter
```

Already cloned it before? Update instead (full update procedure is in
“Updating an existing install” near the end):

```powershell
cd fasttradecounter
git pull
```

---

## Path A — Docker runs everything (recommended for local-only use)

Uses `compose.local.yaml` (login-free `trusted-network`, app reachable from
your LAN, PostgreSQL only reachable from this PC). Your `.env` is never
committed (`.gitignore` covers it).

**A1. Create `.env`:**

```powershell
Copy-Item .env.example .env
notepad .env
```

Replace the contents with this (generate ONE hex password with
`-join ((1..64) | ForEach-Object { '0123456789abcdef'[(Get-Random -Max 16)] })`
in PowerShell, or `openssl rand -hex 32` in Git Bash/macOS/Linux, and paste
the **same** value in both places marked below):

```ini
DATABASE_URL=postgresql://picklane:<paste-hex-here>@127.0.0.1:5432/picklane
ACCESS_MODE=trusted-network
COUNTER_ACCESS_TOKEN=
WAREHOUSE_ACCESS_TOKEN=
ADMIN_PASSWORD=choose-a-unique-password-min-12-chars
SESSION_SECRET=
RETENTION_CRON_TOKEN=
POSTGRES_PASSWORD=<paste-the-same-hex-here>
```

**A2. Build and start** (first run downloads PostgreSQL + builds the app,
applies the SQL migration in `drizzle/`, then starts — give it a few
minutes):

```powershell
docker compose -f compose.local.yaml up --build -d
docker compose -f compose.local.yaml ps          # db + app should be "running"
docker compose -f compose.local.yaml logs -f app # Ctrl+C to stop viewing logs
curl http://localhost:3000/api/health            # -> {"ok":true}
```

**A3. Open it:** <http://localhost:3000> (counter),
<http://localhost:3000/warehouse> (warehouse — click **Enable sound**),
<http://localhost:3000/settings> (unlock with `ADMIN_PASSWORD`).

**A4. Daily use:** containers have `restart: unless-stopped`, so just start
Docker Desktop at logon (Docker Desktop → Settings → “Start Docker Desktop
when you sign in”) and the app comes back by itself. Manual control:

```powershell
docker compose -f compose.local.yaml stop   # stop for today
docker compose -f compose.local.yaml start  # start again
docker compose -f compose.local.yaml down   # remove containers (data KEPT)
# ⚠️ `down -v` also deletes the picklane_data volume = DELETES ALL DATA.
```

Now go to **First run checklist** below.

---

## Path B — PostgreSQL in Docker, app with Node (for development)

**B1.** Create `.env` exactly as in **A1** (same file works for both Docker
services and for Node on the host, because `compose.local.yaml` publishes
PostgreSQL on `127.0.0.1:5432` and `DATABASE_URL` points there).

**B2. Start only the database, install, migrate, run:**

```powershell
docker compose -f compose.local.yaml up -d db
npm ci                      # needs package-lock.json; if your copy has none: npm install
npx drizzle-kit migrate     # creates all tables in the empty database
npm run dev                 # development: http://localhost:3000 (hot reload)
```

For everyday (non-development) use on this path, run the production build
instead of `npm run dev`:

```powershell
npm run build
npm run start               # leave this terminal open; Ctrl+C stops the app
```

---

## Path C — No Docker: install PostgreSQL yourself

**C1. Install PostgreSQL 15+ (17 recommended):**

- **Windows:** installer from <https://www.postgresql.org/download/windows/>.
  Remember the `postgres` superuser password you set and keep port `5432`.
  Use letters/numbers only in the password (special characters must be
  URL-encoded inside `DATABASE_URL`). PostgreSQL runs as an automatic
  Windows service afterwards. In new terminals, `psql` lives in
  `C:\Program Files\PostgreSQL\17\bin` (add it to PATH, or use the
  “SQL Shell (psql)” start-menu entry).
- **macOS:** `brew install postgresql@17 && brew services start postgresql@17`
  (Homebrew uses your macOS username, no password — see C3).
- **Linux (Debian/Ubuntu):** `sudo apt install postgresql` then
  `sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"`

**C2. Create the empty database:**

```powershell
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE app_db;"
```

(macOS/Homebrew: `createdb app_db`. Linux: `sudo -u postgres createdb app_db`.)

**C3. Create `.env`** (`Copy-Item .env.example .env` then edit). The example
already matches a default Windows/Linux install if the `postgres` password
is `postgres`; otherwise put your real password in `DATABASE_URL`:

```ini
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
ACCESS_MODE=trusted-network
ADMIN_PASSWORD=choose-a-unique-password-min-12-chars
```

macOS/Homebrew example: `DATABASE_URL=postgresql://<your-mac-username>@127.0.0.1:5432/app_db`

**C4. Install, migrate, run:**

```powershell
npm ci                      # or: npm install   (if package-lock.json is missing)
npx drizzle-kit migrate     # fresh, empty database only — see note below
npm run dev                 # development — or: npm run build; npm run start
```

> Migration note: `drizzle-kit migrate` applies the committed SQL in
> `drizzle/` and is safe to re-run after a `git pull` (already-applied
> migrations are skipped). Never run `drizzle-kit push` against a database
> containing live business data.

Now go to **First run checklist** below.

---

## First run checklist (all paths)

1. `curl http://localhost:3000/api/health` → `{"ok":true}` (database connected).
2. Open **<http://localhost:3000>** — the trade counter. The workspace starts
   empty; there is no demo data.
3. Test the full flow: take a snip with **Win + Shift + S**, click the
   counter form, **Ctrl + V** to paste, enter a test order number
   (e.g. `TEST-1`), **Send to warehouse**.
4. Open **<http://localhost:3000/warehouse>** in a second tab/browser, click
   **Enable sound** (required again after every reload — browser autoplay
   rule), confirm the order appears instantly, then
   **Acknowledge → Picking → Completed**.
5. Check **`/history`** shows the completed order, then **`/settings`** —
   unlock with your `ADMIN_PASSWORD` and set your company name/initials.

## Letting the counter & warehouse PCs connect (LAN)

Those PCs need **no install** — just Chrome/Edge.

1. On the server PC find its LAN IP: `ipconfig` → e.g. `192.168.1.50`.
   Give the PC a static/DHCP-reserved IP in your router so it never changes.
2. Allow inbound **TCP 3000** in Windows Firewall for the **Private**
   network profile (Windows usually prompts on first run — choose Private).
3. On each PC bookmark `http://192.168.1.50:3000/` (counter) or
   `http://192.168.1.50:3000/warehouse` (warehouse; click Enable sound).
4. Keep the server PC awake during trading hours (Power & Battery →
   never sleep while plugged in). See `README.md` → “Warehouse computer
   setup” for TV/kiosk and browser settings.

⚠️ `trusted-network` means *any device that can reach port 3000 is trusted*.
Never port-forward 3000/5432 from your router, and don't put this mode on
guest/public Wi-Fi. For anything internet-facing use `compose.yaml`
(`provisioned` mode + tokens behind an HTTPS reverse proxy) — see
`README.md` → “Production deployment”.

## Your PostgreSQL data: where it is, backup, inspect

- **Where:** Path A/B → Docker volume `picklane_data` (survives restarts and
  `docker compose down`; destroyed only by `down -v`). Path C → your
  PostgreSQL data directory. Screenshots are stored *inside* PostgreSQL
  (`private_screenshots` bytea), so one database backup protects everything.
- **Backup (Path A/B):**
  `docker compose -f compose.local.yaml exec db pg_dump -U picklane -d picklane -Fc -f /tmp/picklane.dump`
  then `docker compose -f compose.local.yaml cp db:/tmp/picklane.dump .\picklane.dump`
  — copy that file off the PC. **Restore** into a fresh volume:
  `docker compose -f compose.local.yaml exec -T db pg_restore -U picklane -d picklane --clean < .\picklane.dump`
- **Backup (Path C):** `pg_dump -U postgres -h 127.0.0.1 -d app_db -Fc -f picklane.dump`
- **Inspect:** connect DBeaver/pgAdmin/psql to host `127.0.0.1`, port `5432`,
  database `picklane` (user `picklane`, password = `POSTGRES_PASSWORD`) on
  Path A/B, or database `app_db` (user `postgres`) on Path C.
  Tables: `picking_requests`, `order_status_history`, `private_screenshots`,
  `application_settings`, `application_secrets`.

## Updating an existing install (`git pull`)

Your `.env` and database are **not** in Git, so pulling code never
overwrites your settings or orders. Still: take a DB backup first.

```powershell
cd fasttradecounter
git status        # should be clean apart from your untracked .env
git pull          # get the latest code
```

Then, per path:

- **Path A:** `docker compose -f compose.local.yaml up --build -d`
  (the `migrate` service applies any new SQL migrations automatically).
- **Path B/C:** `npm ci` (or `npm install`), then `npx drizzle-kit migrate`,
  then restart the app (`npm run dev`, or `npm run build` + `npm run start`).

Verify with `curl http://localhost:3000/api/health` → `{"ok":true}`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `npm ci` says no lock file / “can only install with an existing package-lock.json” | Your copy predates the lockfile — run `npm install` once instead (creates it). |
| `npm : File ... npm.ps1 cannot be loaded` in PowerShell | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or run the commands in Command Prompt. |
| `DATABASE_URL is required` | No `.env` in the repo folder, or you ran the command from another folder. `cd` into `fasttradecounter` first. |
| `/api/health` returns `{"ok":false}` / app won't start | PostgreSQL unreachable: Path A/B → `docker compose -f compose.local.yaml ps` (is `db` running/healthy?); Path C → is the PostgreSQL Windows service / `brew services` running? Check `DATABASE_URL` host/port/database and that the DB was created (C2). |
| `password authentication failed` | Password in `DATABASE_URL` ≠ the PostgreSQL user's password. Path A/B: the DB password is set **only when the volume is first created** — changing `POSTGRES_PASSWORD` later does not change the existing DB password (use the original value, or `ALTER USER` inside the container, or recreate the volume losing data). Avoid special characters (they must be URL-encoded in `DATABASE_URL`). |
| `relation "picking_requests" does not exist` | Migration never ran (or ran against a different database): `npx drizzle-kit migrate` (Path B/C) against the DB in `DATABASE_URL`. |
| Port 3000 already in use | Stop the other app/container, or run `npm run dev -- -p 3001` (Path B/C). Path A: edit the `ports:` line in `compose.local.yaml`. |
| Port 5432 already in use (Path B) | You already have a local PostgreSQL on 5432 — either use Path C with it, or change the published port in `compose.local.yaml` to `127.0.0.1:5433:5432` **and** use `5433` in your host `DATABASE_URL`. |
| Warehouse PC just times out | Wrong server IP (step LAN-1), Windows Firewall blocking 3000, PCs on different Wi-Fi/VLAN/guest network, or server PC asleep. Test `http://<server-IP>:3000/api/health` from the warehouse PC. |
| Warehouse shows orders but no sound | Click **Enable sound** after every page load/reload, check the header says **Sound on**, OS volume/output device, don't mute the tab. See `README.md` → “Alerts and connection handling”. |
| Settings says “Administrator access is locked” | `ADMIN_PASSWORD` unset or < 12 chars in `.env`; set it and restart the app (`docker compose -f compose.local.yaml up -d app` / restart `npm run start`). There is intentionally no default password. |
| All data disappeared after Docker cleanup | `docker compose down -v` / volume prune deleted `picklane_data`. Restore from your `pg_dump` backup (above); avoid `-v` in future. |
| `git pull` says “not a git repository” | You downloaded the ZIP instead of cloning. `git clone` fresh (step 1), copy your `.env` across, and point it at your existing database/volume. |

## Environment variables (`.env`) — local summary

| Variable | Local value / purpose |
| --- | --- |
| `DATABASE_URL` | Required. Where Node finds PostgreSQL (host view: `127.0.0.1:5432`). |
| `ACCESS_MODE` | `trusted-network` locally. Setting either access token forces provisioned mode — leave tokens blank locally. |
| `ADMIN_PASSWORD` | Required for `/settings`, ≥ 12 chars, no default. |
| `SESSION_SECRET` | Optional ≥ 32 chars; if blank, one is generated and stored in the DB. |
| `POSTGRES_PASSWORD` | Docker (Path A/B) only; must match the password in `DATABASE_URL`. |
| `COUNTER_ACCESS_TOKEN` / `WAREHOUSE_ACCESS_TOKEN` / `RETENTION_CRON_TOKEN` | Leave blank locally; production use only (see `README.md`). |

For production deployment (provisioned device tokens, HTTPS reverse proxy,
retention cron), see `README.md`.
