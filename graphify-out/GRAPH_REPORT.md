# Graph Report - baha-ui  (2026-06-25)

## Corpus Check
- 61 files · ~154,173 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 518 nodes · 1049 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8311a3f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `LatLng` - 20 edges
2. `Severity` - 19 edges
3. `compilerOptions` - 18 edges
4. `useI18n()` - 17 edges
5. `App()` - 14 edges
6. `EnrichedReport` - 13 edges
7. `FloodAlert` - 12 edges
8. `AdminPanelProps` - 12 edges
9. `FloodReport` - 11 edges
10. `EvacuationCenter` - 11 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/hooks/useAuth.ts
- `App()` --calls--> `useI18n()`  [EXTRACTED]
  src/App.tsx → src/i18n.ts
- `PermissionNote()` --calls--> `useI18n()`  [EXTRACTED]
  src/components/panels/NotifyModal.tsx → src/i18n.ts
- `PublicDashboardModal()` --calls--> `useI18n()`  [EXTRACTED]
  src/components/panels/PublicDashboardModal.tsx → src/i18n.ts
- `TopBar()` --calls--> `useI18n()`  [EXTRACTED]
  src/components/panels/TopBar.tsx → src/i18n.ts

## Communities (23 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.28
Nodes (8): AlertLevel, TREND_META, activityClause(), ALERT_NOTE, buildShareLinks(), buildShareText(), ShareInputs, ShareText

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (40): boot(), collectProps(), compileAttr(), compileTemplate(), createComponentFactory(), createExternalModules(), createHelmetManager(), createPseudoSheet() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (36): AdminPanelProps, Field, FIELDS, FieldType, FormValues, inputStyle, levelOptions, roadOptions (+28 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (24): api, buildQuery(), GeoResult, NominatimAddress, NominatimReverseRow, NominatimRow, reverseGeocode(), ReverseResult (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): dependencies, leaflet, react, react-dom, react-leaflet, @react-oauth/google, description, devDependencies (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (25): mutations, rawApi, useActivityStream(), useIsMobile(), useAcceptedFeatures(), useAlerts(), useAllFeedback(), useCenters() (+17 more)

### Community 6 - "Community 6"
Cohesion: 0.20
Nodes (17): roadFromDepth(), cellKey(), clipToCircle(), lerp(), loadRoads(), meters(), mPerDegLng(), pointAt() (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (36): DEFAULT_NOTIFY_PREFS, fmtKm(), NotifyModal(), NotifyModalProps, NotifyPrefs, PermissionNote(), SEV_ORDER, ConditionPill() (+28 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (8): BBOX, cols, els, json, OUT, roads, rows, ways

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (10): compilerOptions, allowSyntheticDefaultImports, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.20
Nodes (8): Architecture, code:bash (npm run dev          # Vite on :5176, proxies /api → baha-ap), Commands, Conventions, Env, Mock backend, Note on `design/`, What this is

### Community 12 - "Community 12"
Cohesion: 0.20
Nodes (9): Architecture, Build & deploy, code:bash (npm install), code:bash (npm run typecheck), code:bash (# Build (pass the Google client id; defaults to /api for the), code:bash (VITE_GOOGLE_CLIENT_ID=<id> docker compose up --build   # ser), Docker, floodedarea-ui (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (33): ApiError, FloodMap(), FloodMapProps, MapFocus, pendingIcon(), searchIcon(), SearchMark, shelterIcon() (+25 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (8): alerts, centers, feedback, hotlines, reports, rescues, stats, visits

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): buildTime, env, pkg

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (18): useReportHistory(), EvacDetailCard(), EvacDetailCardProps, dateLabel(), M, WaterLevelModal(), WaterLevelModalProps, LatLng (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (49): PAGE_SIZE_OPTIONS, PublicDashboardModalProps, RADIUS_OPTIONS, DEPTH_TICKS, ReportDetailCard(), ReportDetailCardProps, RoadConditionsModalProps, Option (+41 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (13): code:bash (curl -sI https://floodedarea.com/manifest.webmanifest   # ex), code:bash (npm install -g @bubblewrap/cli         # or use: npx @bubble), code:bash (bubblewrap build                       # → signed .aab + key), code:block4 (/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOO), FloodedArea — Google Play packaging (TWA) runbook, ⚠️ Hard ordering dependency — deploy before Phase 2, Out of scope — manual steps for Ardz (do NOT automate), Phase 2 — Initialize the TWA (+5 more)

## Knowledge Gaps
- **160 isolated node(s):** `target`, `lib`, `module`, `skipLibCheck`, `moduleResolution` (+155 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `LatLng` connect `Community 20` to `Community 2`, `Community 5`, `Community 6`, `Community 13`, `Community 21`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `Severity` connect `Community 21` to `Community 8`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `useI18n()` connect `Community 8` to `Community 21`, `Community 3`, `Community 5`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `target`, `lib`, `module` to the rest of the system?**
  _160 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07372549019607844 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07957957957957958 - nodes in this community are weakly interconnected._