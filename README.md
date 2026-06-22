# floodedarea-ui

FloodedArea — a flood-watch web app for the Philippines. Crowd-sourced flood
reports on an interactive map, evacuation centers, a live activity feed, rainfall
alerts, safe-route hints, and an SOS rescue request. React 18 + Vite + TypeScript
on Leaflet/OpenStreetMap. Mirrors the structure of `appointment-web`.

## Run

```bash
npm install

# Against the real API (baha-api on :8083) — the default:
npm run dev            # → http://localhost:5176  (proxies /api → :8083)

# Offline, against the json-server mock:
npm run dev:mock       # runs Vite (pointed at the mock) + the mock on :3001
```

Create `.env` from `.env.example` and set `VITE_GOOGLE_CLIENT_ID` (the same OAuth
Web client id the API uses). Sign-in is **Google SSO only**, so this is required
for login to work.

## Architecture

- `src/api/client.ts` — fetch wrapper; JWT from `sessionStorage` (`baha_jwt_v1`).
- `src/api/queries.ts` — typed GETs + mutations.
- `src/hooks/` — `useFetch` (generic), `useDomainData` (reports/centers/hotlines/alerts),
  `useAuth` (Basic + Google SSO), `useActivityStream` (SSE), `useBreakpoint`.
- `src/utils/viewModel.ts` — derived map/sidebar state (distances, safety status, safe route).
- `src/components/map/FloodMap.tsx` — Leaflet map (reports, shelters, you, route).
- `src/components/panels/` — top bar, alert ribbon, sidebar, detail cards, severity picker, SOS, toast.
- `src/App.tsx` — owns view state and threads data + callbacks down.

The flood map is public; reporting, confirming, and SOS prompt sign-in. ADMIN
accounts get management capabilities via baha-api.

## Build & deploy

```bash
npm run typecheck
npm run build      # → dist/  (committed to the repo; rebuild and commit on changes)
```

`dist/` is tracked in git and shipped as the deploy artifact. It's built with
`.env.production` (`VITE_API_URL=/api`, so the app talks to a same-origin reverse
proxy) plus the `VITE_GOOGLE_CLIENT_ID` from your local `.env`. **Rebuild and commit
`dist/` whenever `src/` or env changes**, or the deployed bundle goes stale.

### Docker

A multi-stage image (Node build → nginx) serves the static bundle and reverse-proxies
`/api` (and `/api/sse/activity`) to the backend — mirroring the Vite dev proxy, which
strips the `/api` prefix. `VITE_*` values are **baked at build time** via build args;
the proxy target `API_UPSTREAM` is set at **run time**.

```bash
# Build (pass the Google client id; defaults to /api for the API base):
docker build -t floodedarea-ui \
  --build-arg VITE_GOOGLE_CLIENT_ID=<oauth-web-client-id> .

# Run, pointing the proxy at a reachable API:
docker run -p 8080:80 -e API_UPSTREAM=http://host.docker.internal:8083 floodedarea-ui
# → http://localhost:8080
```

Or via Compose (reads `VITE_GOOGLE_CLIENT_ID` / `API_UPSTREAM` from your shell/`.env`):

```bash
VITE_GOOGLE_CLIENT_ID=<id> docker compose up --build   # serves on :8080
```

Run the API (`floodedarea-api`) separately; by default the UI proxies to an API on the
host's `:8083`. The backend's `GOOGLE_CLIENT_ID` must match the UI's client id, or
Google token verification fails (`aud` mismatch).
