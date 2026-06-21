# baha-ui

BahaWatch — a flood-watch web app for Metro Manila & Rizal. Crowd-sourced flood
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
Web client id baha-api uses) to enable Google SSO. Basic login works without it.

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

## Build

```bash
npm run typecheck
npm run build      # → dist/
```
