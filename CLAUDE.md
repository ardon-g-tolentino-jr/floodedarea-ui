# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**FloodedArea** (`baha-ui`) — a flood-watch single-page web app for Metro Manila & Rizal:
crowd-sourced flood reports on a Leaflet map, evacuation centers, a live activity feed,
rainfall alerts, and an SOS rescue request. React 18 + Vite + TypeScript.
The UI structure deliberately mirrors a sibling project, `appointment-web`.

## Commands

```bash
npm run dev          # Vite on :5176, proxies /api → baha-api (:8083). Opens browser.
npm run dev:mock     # Vite + json-server mock (:3001) together — offline UI work
npm run mock         # just the json-server mock on :3001
npm run demo         # Vite (:5188, strict port) + mock, killed together
npm run build        # tsc -b && vite build → dist/
npm run typecheck    # tsc -b --noEmit
npm run preview      # serve the built dist/
```

There is **no test runner and no linter configured** — `typecheck` is the only gate. Run it
after changes. ESLint-disable comments exist in source but no eslint config is installed.

### Env
Copy `.env.example` → `.env`. `VITE_GOOGLE_CLIENT_ID` enables Google SSO (optional — Basic
login works without it). `VITE_API_URL` overrides the backend; when unset the app calls `/api`
and Vite proxies it (see `vite.config.ts`). The mock points the UI at `:3001`.

## Architecture

The app is a **single stateful screen**. There is no router and no global store —
`src/App.tsx` owns essentially all UI state (selection, filters, report mode, modals, toast)
and threads data + callbacks down into presentational components. When adding a feature,
expect to add state and a handler in `App.tsx` rather than introducing context/redux.

**Data flow, outermost → in:**

1. `src/api/client.ts` — thin `fetch` wrapper (`api.get/post/patch/...`). Reads the JWT from
   `sessionStorage['baha_jwt_v1']` and attaches `Authorization: Bearer`. Throws `ApiError`
   with user-facing messages; preserves the server `message` only for 401/403/409/429.
2. `src/api/queries.ts` — typed endpoints: `rawApi` (GETs) and `mutations` (writes). baha-api
   returns domain-shaped camelCase JSON, so these map 1:1 to `src/types.ts`.
3. `src/hooks/useFetch.ts` — generic fetch hook with a request-id guard against stale
   responses (no AbortController, intentionally, to stay quiet under React 18 strict mode).
   `refetch(true)` does a background refresh without the loading flash.
4. `src/hooks/useDomainData.ts` — `useReports/useCenters/useHotlines/useAlerts` wrap `useFetch`.
5. `src/utils/viewModel.ts` — **pure** derivation of everything the map/sidebar show:
   `enrichReports` (distance, severity meta, `mine`) and `computeStatus` (the safety banner with
   spread-ETA heuristics). Distance uses a haversine helper (`kmBetween` in `utils/geo.ts`).
   Keep this layer side-effect-free.

**Other key pieces:**
- `src/hooks/useAuth.ts` — Basic login/register + Google SSO. Persists `AuthState` to
  `sessionStorage['baha_auth_v1']` and the token to `baha_jwt_v1`. Role is `CITIZEN`/`ADMIN`.
- `src/hooks/useActivityStream.ts` — subscribes to the public SSE stream (`/sse/activity`);
  on any event `App` does `reports.refetch(true)` to live-update the map.
- `src/utils/floodMeta.ts` — single source for severity/trend/road colors, labels, advice,
  the report quick-pick presets (`SEVERITY_PRESET`), and sparkline/water-level math. Most
  visual constants and domain copy live here, ported from the design — change them here, not
  inline in components.
- `src/components/map/FloodMap.tsx` — the Leaflet/react-leaflet map (reports, shelters, you,
  route). `src/components/panels/` — TopBar, AlertRibbon, Sidebar, detail cards, SeverityPicker,
  SosModal, Toast (presentational; driven by props from `App`).

**Auth gating:** the map is public. Reporting, confirming, and SOS call `requireAuth(reason)`
in `App.tsx`, which opens `LoginView` if there's no session. ADMIN gets management
capabilities via baha-api (not all surfaced in this UI).

## Conventions

- **Styling is inline** (`style={{...}}` objects) plus CSS custom properties (`var(--bw-*)`)
  defined in `src/styles.css`. There is no CSS framework or CSS modules. Match this when
  editing components; pull colors from `floodMeta.ts` / the `--bw-*` vars rather than hardcoding.
- `src/types.ts` is the single source of truth for domain types; field names mirror baha-api's
  camelCase JSON. Add new domain shapes there.
- Keep derived/computed logic in `utils/` as pure functions; keep `App.tsx` as the orchestrator.

## Mock backend

`mock-api/server.cjs` is a json-server mock mirroring baha-api for offline work. Reads/writes
for `/reports /centers /hotlines /alerts /rescue` come from `mock-api/db.json`. Auth,
`/reports/:id/confirm`, and `/sse/activity` are **stubbed** (auth accepts anything; an email
starting with `admin` returns role `ADMIN`; SSE opens but emits no further events). `/rescue`
persists requests to `db.json` and broadcasts a `rescue-created` SSE event. Edit `db.json` to
change seed data.

## Note on `design/`

`design/*.dc.html` are standalone design-comp prototypes. The production app's domain logic
and visual constants were ported from them into `src/utils/floodMeta.ts` and
`src/utils/viewModel.ts`. They are reference, not built or imported.

## Development Process

> **Note:** This is a frontend repo. It carries no `.sql` files and no `documentations/`. All SQL and docs live in the paired backend repo. The branch/changelog/migration workflow still applies — coordinate DB changes with the backend repo.

Follow this sequence for **every** feature or bugfix — no exceptions.

### Step 1 — Create a numbered branch
```bash
git checkout main && git pull
git checkout -b <NNN>-<type>-<short-description>
```
- `NNN` = next zero-padded number after the highest existing branch (`001`, `002`, …)
- `type` = `feat` or `fix`
- Same string reused for the DB folder and changelog entry

### Step 2 — Clarify before coding
Confirm scope, DB impact, backward compatibility, UI changes, and any credentials needed. Ask if uncertain.

### Step 3 — Append to `db/setup.sql` *(only if DB changed)*
Append new schema to the end of `db/setup.sql` (backend repo) — **never rewrite existing statements**. Every statement must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DO $$ BEGIN … END $$` for enums). Include the app role/grants block and indexes for every new object.

### Step 4 — Create `db/<NNN>-<type>-<desc>/migration.sql` *(only if DB changed)*
One migration per branch — all DB changes for this branch in one file. Idempotent. Apply only the delta. Match `setup.sql` column types/names. Include indexes (`CREATE INDEX IF NOT EXISTS`) and `ANALYZE` for new objects.

### Step 5 — Create `db/<NNN>-<type>-<desc>/rollback.sql` *(only if DB changed)*
Reverses `migration.sql` exactly. Idempotent (`DROP TABLE IF EXISTS`, `DROP COLUMN IF EXISTS`). Note irreversible data loss in a comment at the top.

### Step 6 — Update `documentations/CHANGELOG.md` (backend repo)
Add a new entry at the **top** (most recent first):
```markdown
## [<NNN>-<type>-<short-description>] — YYYY-MM-DD

**Summary:** What changed and why.

### Frontend
- ...

### Backend
- ...

### Database
- setup.sql appended: yes/no
- Migration: db/<NNN>-<type>-<desc>/migration.sql
- Rollback:  db/<NNN>-<type>-<desc>/rollback.sql

### Config / Env
- ...

### Testing
- ...
```

### Step 7 — Apply migration locally & provide execution summary *(only if DB changed)*
Run the migration against the local DB, then provide a copy-pasteable summary:
```
psql "$DB_URL" -f db/<NNN>-<type>-<desc>/migration.sql
```

### Step 8 — Completion report
```
COMPLETION REPORT — <NNN>-<type>-<short-description>

Frontend changes:  <files / behavior>  (or "none")
Backend changes:   <endpoints / services>  (or "none")
Database changes:  <setup.sql / migration / rollback>  (or "none")
```

### Rules
- **No direct commits to `main`** — always branch first.
- **All SQL lives in the backend repo** — frontend carries no `.sql` files.
- **All documentation lives in the backend repo** under `documentations/` — even for frontend-only changes.
- **Frontend `/dist` must be rebuilt and committed** when frontend changes (`npm run build`).
- **Test locally only** — no Docker, no mock data when the backend is running.
- **Never hardcode or commit secrets** — use env vars.
- **Every SQL statement must be idempotent** — safe to re-run.
- **Index every FK column and every column used in WHERE/JOIN/ORDER BY** at creation time.
