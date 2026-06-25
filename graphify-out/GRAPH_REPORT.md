# Graph Report - baha-ui  (2026-06-25)

## Corpus Check
- 61 files · ~153,238 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 517 nodes · 1027 edges · 25 communities (22 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1e8bb7d8`
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
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]

## God Nodes (most connected - your core abstractions)
1. `LatLng` - 20 edges
2. `Severity` - 19 edges
3. `compilerOptions` - 18 edges
4. `App()` - 14 edges
5. `EnrichedReport` - 13 edges
6. `useI18n()` - 12 edges
7. `FloodAlert` - 12 edges
8. `AdminPanelProps` - 12 edges
9. `FloodReport` - 11 edges
10. `EvacuationCenter` - 11 edges

## Surprising Connections (you probably didn't know these)
- `RescueChartModalProps` --references--> `RescueRequest`  [EXTRACTED]
  src/components/panels/RescueChartModal.tsx → src/types.ts
- `buildWaterChart()` --calls--> `waterSeries()`  [EXTRACTED]
  src/utils/waterChart.ts → src/utils/floodMeta.ts
- `App()` --calls--> `useAuth()`  [EXTRACTED]
  src/App.tsx → src/hooks/useAuth.ts
- `App()` --calls--> `useI18n()`  [EXTRACTED]
  src/App.tsx → src/i18n.ts
- `PublicDashboardModal()` --calls--> `useI18n()`  [EXTRACTED]
  src/components/panels/PublicDashboardModal.tsx → src/i18n.ts

## Communities (25 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.20
Nodes (13): DEPTH_TICKS, ReportDetailCard(), ReportDetailCardProps, ADVICE, ROAD_META, ROAD_ORDER, SevMeta, sparkPaths() (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (40): boot(), collectProps(), compileAttr(), compileTemplate(), createComponentFactory(), createExternalModules(), createHelmetManager(), createPseudoSheet() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (40): AdminPanelProps, Field, FIELDS, FieldType, FormValues, inputStyle, levelOptions, roadOptions (+32 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (24): api, buildQuery(), GeoResult, NominatimAddress, NominatimReverseRow, NominatimRow, reverseGeocode(), ReverseResult (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): dependencies, leaflet, react, react-dom, react-leaflet, @react-oauth/google, description, devDependencies (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (35): mutations, rawApi, useActivityStream(), useIsMobile(), useAcceptedFeatures(), useAlerts(), useAllFeedback(), useCenters() (+27 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (26): EvacDetailCard(), EvacDetailCardProps, WaterLevelModalProps, LatLng, kmBetween(), toRad(), walkMinutes(), cellKey() (+18 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (24): ConditionPill(), PublicDashboardModal(), DEFAULT_OPEN, fmtRadius(), SectionKey, Sidebar(), SidebarProps, Tab (+16 more)

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
Cohesion: 0.10
Nodes (19): ALERT_RANK, TONE, RESCUE_STATUS_RANK, roadFromDepth(), SEV_RANK, formatDuration(), minutesSince(), timeAgo() (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (8): alerts, centers, feedback, hotlines, reports, rescues, stats, visits

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): buildTime, env, pkg

### Community 20 - "Community 20"
Cohesion: 0.20
Nodes (9): ApiError, dateLabel(), RescueChartModal(), RescueChartModalProps, STATUS_STYLE, DISTRICT_COLORS, RESCUE_STATUS_META, rescueCountsByDistrict() (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.08
Nodes (29): useReportHistory(), DEFAULT_NOTIFY_PREFS, fmtKm(), NotifyModal(), NotifyModalProps, NotifyPrefs, SEV_ORDER, Option (+21 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (13): code:bash (curl -sI https://floodedarea.com/manifest.webmanifest   # ex), code:bash (npm install -g @bubblewrap/cli         # or use: npx @bubble), code:bash (bubblewrap build                       # → signed .aab + key), code:block4 (/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOO), FloodedArea — Google Play packaging (TWA) runbook, ⚠️ Hard ordering dependency — deploy before Phase 2, Out of scope — manual steps for Ardz (do NOT automate), Phase 2 — Initialize the TWA (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.24
Nodes (12): PAGE_SIZE_OPTIONS, PublicDashboardModalProps, RADIUS_OPTIONS, RoadConditionsModalProps, FloodReport, Road, ROAD_RANK, DistrictRoads (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (11): FloodMap(), FloodMapProps, MapFocus, pendingIcon(), searchIcon(), SearchMark, shelterIcon(), shelterIconHtml() (+3 more)

## Knowledge Gaps
- **161 isolated node(s):** `target`, `lib`, `module`, `skipLibCheck`, `moduleResolution` (+156 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Severity` connect `Community 21` to `Community 0`, `Community 2`, `Community 5`, `Community 8`, `Community 13`, `Community 23`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `LatLng` connect `Community 6` to `Community 2`, `Community 5`, `Community 13`, `Community 21`, `Community 23`, `Community 24`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `useI18n()` connect `Community 8` to `Community 3`, `Community 5`, `Community 23`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `target`, `lib`, `module` to the rest of the system?**
  _161 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0707070707070707 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07957957957957958 - nodes in this community are weakly interconnected._