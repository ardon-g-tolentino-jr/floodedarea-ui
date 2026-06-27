# Graph Report - baha-ui  (2026-06-28)

## Corpus Check
- 66 files · ~158,784 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 559 nodes · 1119 edges · 28 communities (25 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cedb9299`
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
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 21 edges
2. `LatLng` - 20 edges
3. `Severity` - 19 edges
4. `compilerOptions` - 18 edges
5. `App()` - 16 edges
6. `EnrichedReport` - 13 edges
7. `FloodAlert` - 12 edges
8. `AdminPanelProps` - 12 edges
9. `FloodReport` - 11 edges
10. `EvacuationCenter` - 11 edges

## Surprising Connections (you probably didn't know these)
- `SosModalProps` --references--> `Hotline`  [EXTRACTED]
  src/components/panels/SosModal.tsx → src/types.ts
- `WaterLevelModalProps` --references--> `LatLng`  [EXTRACTED]
  src/components/panels/WaterLevelModal.tsx → src/types.ts
- `RescueChartModalProps` --references--> `RescueRequest`  [EXTRACTED]
  src/components/panels/RescueChartModal.tsx → src/types.ts
- `App()` --calls--> `tFormat()`  [EXTRACTED]
  src/App.tsx → src/i18n.ts
- `App()` --calls--> `useI18n()`  [EXTRACTED]
  src/App.tsx → src/i18n.ts

## Communities (28 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.28
Nodes (8): AlertLevel, TREND_META, activityClause(), ALERT_NOTE, buildShareLinks(), buildShareText(), ShareInputs, ShareText

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (40): boot(), collectProps(), compileAttr(), compileTemplate(), createComponentFactory(), createExternalModules(), createHelmetManager(), createPseudoSheet() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (43): AdminPanelProps, Field, FIELDS, FieldType, FormValues, inputStyle, levelOptions, roadOptions (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (20): GeoResult, NominatimAddress, NominatimReverseRow, NominatimRow, reverseGeocode(), ReverseResult, searchPlaces(), AuthState (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): dependencies, leaflet, react, react-dom, react-leaflet, @react-oauth/google, description, devDependencies (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (33): api, ApiError, buildQuery(), mutations, rawApi, useActivityStream(), AuthResponse, useAuth() (+25 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (24): EvacDetailCard(), EvacDetailCardProps, LatLng, kmBetween(), toRad(), walkMinutes(), cellKey(), clipToCircle() (+16 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (31): LocationHelpModal(), LocationHelpModalProps, DEFAULT_NOTIFY_PREFS, fmtKm(), NotifyModal(), NotifyModalProps, NotifyPrefs, PermissionNote() (+23 more)

### Community 9 - "Community 9"
Cohesion: 0.18
Nodes (8): BBOX, cols, els, json, OUT, roads, rows, ways

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (10): compilerOptions, allowSyntheticDefaultImports, lib, module, moduleResolution, noEmit, skipLibCheck, strict (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.08
Nodes (22): Architecture, code:bash (npm run dev          # Vite on :5176, proxies /api → baha-ap), code:bash (git checkout main && git pull), code:markdown (## [<NNN>-<type>-<short-description>] — YYYY-MM-DD), code:block4 (psql "$DB_URL" -f db/<NNN>-<type>-<desc>/migration.sql), code:block5 (COMPLETION REPORT — <NNN>-<type>-<short-description>), Commands, Conventions (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.20
Nodes (9): Architecture, Build & deploy, code:bash (npm install), code:bash (npm run typecheck), code:bash (# Build (pass the Google client id; defaults to /api for the), code:bash (VITE_GOOGLE_CLIENT_ID=<id> docker compose up --build   # ser), Docker, floodedarea-ui (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.10
Nodes (19): FloodMap(), FloodMapProps, MapFocus, pendingIcon(), searchIcon(), SearchMark, shelterIcon(), shelterIconHtml() (+11 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (8): alerts, centers, feedback, hotlines, reports, rescues, stats, visits

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): buildTime, env, pkg

### Community 20 - "Community 20"
Cohesion: 0.16
Nodes (15): DEPTH_TICKS, ReportDetailCard(), ReportDetailCardProps, ADVICE, RESCUE_STATUS_RANK, ROAD_META, ROAD_ORDER, ROAD_RANK (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (16): Option, OPTIONS, SeverityPickerProps, Severity, Trend, DEPTH_RANGE, SEVERITY_PRESET, waterSeries() (+8 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (13): code:bash (curl -sI https://floodedarea.com/manifest.webmanifest   # ex), code:bash (npm install -g @bubblewrap/cli         # or use: npx @bubble), code:bash (bubblewrap build                       # → signed .aab + key), code:block4 (/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOO), FloodedArea — Google Play packaging (TWA) runbook, ⚠️ Hard ordering dependency — deploy before Phase 2, Out of scope — manual steps for Ardz (do NOT automate), Phase 2 — Initialize the TWA (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (19): PAGE_SIZE_OPTIONS, PublicDashboardModalProps, RADIUS_OPTIONS, RoadConditionsModalProps, FloodReport, Road, roadFromDepth(), buildRoadDirectory() (+11 more)

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (8): dateLabel(), RescueChartModal(), RescueChartModalProps, STATUS_STYLE, DISTRICT_COLORS, RESCUE_STATUS_META, rescueCountsByDistrict(), rescuesOnLocalDate()

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (15): ConditionPill(), DEFAULT_OPEN, fmtRadius(), SectionKey, Sidebar(), SidebarProps, Tab, TONE (+7 more)

### Community 26 - "Community 26"
Cohesion: 0.26
Nodes (10): TurnstileWidget(), TurnstileWidgetProps, captchaEnabled(), getCaptchaToken(), loadScript(), loadTurnstile(), SITE_KEY, TURNSTILE_SITE_KEY (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.24
Nodes (8): dateLabel(), M, WaterLevelModal(), WaterLevelModalProps, DEPTH_TICKS, SEV_META, localDateKey(), buildDailyWaterBars()

## Knowledge Gaps
- **180 isolated node(s):** `target`, `lib`, `module`, `skipLibCheck`, `moduleResolution` (+175 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `Community 8` to `Community 25`, `Community 3`, `Community 5`, `Community 23`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Why does `LatLng` connect `Community 6` to `Community 2`, `Community 5`, `Community 13`, `Community 23`, `Community 27`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `Severity` connect `Community 21` to `Community 2`, `Community 5`, `Community 8`, `Community 20`, `Community 23`, `Community 25`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `target`, `lib`, `module` to the rest of the system?**
  _180 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06641604010025062 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11396011396011396 - nodes in this community are weakly interconnected._