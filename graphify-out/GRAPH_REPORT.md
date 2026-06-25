# Graph Report - baha-ui  (2026-06-25)

## Corpus Check
- 59 files · ~151,338 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 494 nodes · 966 edges · 22 communities (19 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `26e8ac47`
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
2. `compilerOptions` - 18 edges
3. `Severity` - 18 edges
4. `EnrichedReport` - 13 edges
5. `App()` - 12 edges
6. `FloodAlert` - 12 edges
7. `AdminPanelProps` - 12 edges
8. `FloodReport` - 11 edges
9. `EvacuationCenter` - 11 edges
10. `useFetch()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `WaterLevelModalProps` --references--> `LatLng`  [EXTRACTED]
  src/components/panels/WaterLevelModal.tsx → src/types.ts
- `RescueChartModalProps` --references--> `RescueRequest`  [EXTRACTED]
  src/components/panels/RescueChartModal.tsx → src/types.ts
- `buildWaterChart()` --calls--> `waterSeries()`  [EXTRACTED]
  src/utils/waterChart.ts → src/utils/floodMeta.ts
- `App()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/hooks/useAuth.ts
- `Option` --references--> `Severity`  [EXTRACTED]
  src/components/panels/SeverityPicker.tsx → src/types.ts

## Communities (22 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (32): DEPTH_TICKS, ReportDetailCard(), ReportDetailCardProps, NET_GLYPH, ShareModalProps, DEFAULT_OPEN, fmtRadius(), SectionKey (+24 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (40): boot(), collectProps(), compileAttr(), compileTemplate(), createComponentFactory(), createExternalModules(), createHelmetManager(), createPseudoSheet() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (40): FloodMapProps, AdminPanelProps, Field, FIELDS, FieldType, FormValues, inputStyle, levelOptions (+32 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (20): GeoResult, NominatimAddress, NominatimReverseRow, NominatimRow, reverseGeocode(), ReverseResult, searchPlaces(), AuthResponse (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): dependencies, leaflet, react, react-dom, react-leaflet, @react-oauth/google, description, devDependencies (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (28): mutations, rawApi, useActivityStream(), useIsMobile(), useAcceptedFeatures(), useAlerts(), useAllFeedback(), useCenters() (+20 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (25): EvacDetailCard(), EvacDetailCardProps, LatLng, kmBetween(), toRad(), walkMinutes(), cellKey(), clipToCircle() (+17 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

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
Nodes (38): FloodMap(), MapFocus, pendingIcon(), searchIcon(), SearchMark, shelterIcon(), shelterIconHtml(), youIcon() (+30 more)

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (6): alerts, centers, feedback, hotlines, reports, rescues

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): buildTime, env, pkg

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (13): api, ApiError, buildQuery(), dateLabel(), RescueChartModal(), RescueChartModalProps, STATUS_STYLE, DISTRICT_COLORS (+5 more)

### Community 21 - "Community 21"
Cohesion: 0.08
Nodes (28): DEFAULT_NOTIFY_PREFS, fmtKm(), NotifyModal(), NotifyModalProps, NotifyPrefs, SEV_ORDER, Option, OPTIONS (+20 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (13): code:bash (curl -sI https://floodedarea.com/manifest.webmanifest   # ex), code:bash (npm install -g @bubblewrap/cli         # or use: npx @bubble), code:bash (bubblewrap build                       # → signed .aab + key), code:block4 (/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOO), FloodedArea — Google Play packaging (TWA) runbook, ⚠️ Hard ordering dependency — deploy before Phase 2, Out of scope — manual steps for Ardz (do NOT automate), Phase 2 — Initialize the TWA (+5 more)

## Knowledge Gaps
- **156 isolated node(s):** `target`, `lib`, `module`, `skipLibCheck`, `moduleResolution` (+151 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `LatLng` connect `Community 6` to `Community 5`, `Community 2`, `Community 21`, `Community 13`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `Severity` connect `Community 21` to `Community 0`, `Community 2`, `Community 13`, `Community 5`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `GeoResult` connect `Community 3` to `Community 2`, `Community 13`, `Community 5`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `target`, `lib`, `module` to the rest of the system?**
  _156 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07862679955703211 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0707070707070707 - nodes in this community are weakly interconnected._