# Graph Report - baha-ui  (2026-07-10)

## Corpus Check
- 72 files · ~167,443 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 595 nodes · 1216 edges · 23 communities (20 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f64ce33b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 26|Community 26]]

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 21 edges
2. `Severity` - 20 edges
3. `LatLng` - 20 edges
4. `compilerOptions` - 18 edges
5. `App()` - 18 edges
6. `FloodReport` - 13 edges
7. `EnrichedReport` - 13 edges
8. `useFetch()` - 13 edges
9. `FloodAlert` - 12 edges
10. `SEV_META` - 12 edges

## Surprising Connections (you probably didn't know these)
- `LoginView()` --calls--> `useI18n()`  [EXTRACTED]
  src/views/LoginView.tsx → src/i18n.ts
- `SeverityPickerProps` --references--> `Severity`  [EXTRACTED]
  src/components/panels/SeverityPicker.tsx → src/types.ts
- `SosModalProps` --references--> `Hotline`  [EXTRACTED]
  src/components/panels/SosModal.tsx → src/types.ts
- `Props` --references--> `NewReport`  [EXTRACTED]
  src/components/panels/AdminReportIncidentModal.tsx → src/types.ts
- `RescueChartModalProps` --references--> `RescueRequest`  [EXTRACTED]
  src/components/panels/RescueChartModal.tsx → src/types.ts

## Communities (23 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.16
Nodes (13): AdminReportIncidentModal(), hoursAgoFrom(), inputStyle, labelStyle, Props, SEV_ORDER, TTL_OPTIONS, OPTIONS (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (40): boot(), collectProps(), compileAttr(), compileTemplate(), createComponentFactory(), createExternalModules(), createHelmetManager(), createPseudoSheet() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (43): AdminPanelProps, Field, FIELDS, FieldType, FormValues, inputStyle, levelOptions, roadOptions (+35 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (28): GeoResult, nearViewbox(), NominatimAddress, NominatimReverseRow, NominatimRow, reverseGeocode(), ReverseResult, searchPlaces() (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): dependencies, leaflet, react, react-dom, react-leaflet, @react-oauth/google, description, devDependencies (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (38): mutations, rawApi, useActivityStream(), useAuth(), useIsMobile(), useAcceptedFeatures(), useAcceptedFeedback(), useAlerts() (+30 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.07
Nodes (34): LocationHelpModal(), LocationHelpModalProps, DEFAULT_NOTIFY_PREFS, fmtKm(), NotifyModal(), NotifyModalProps, NotifyPrefs, PermissionNote() (+26 more)

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

### Community 14 - "Community 14"
Cohesion: 0.20
Nodes (9): alerts, centers, feedback, hotlines, incidents, reports, rescues, stats (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): buildTime, env, pkg

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (59): Props, PAGE_SIZE_OPTIONS, PublicDashboardModalProps, RADIUS_OPTIONS, DEPTH_TICKS, ReportDetailCard(), ReportDetailCardProps, RoadConditionsModalProps (+51 more)

### Community 21 - "Community 21"
Cohesion: 0.06
Nodes (31): api, ApiError, buildQuery(), FloodMap(), FloodMapProps, MapFocus, pendingIcon(), searchIcon() (+23 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (17): code:nginx (location = /manifest.webmanifest {), code:bash (curl -sI https://floodedarea.com/manifest.webmanifest | grep), code:bash (curl -sI https://floodedarea.com/manifest.webmanifest), code:bash (npm install -g @bubblewrap/cli         # or use: npx @bubble), code:bash (bubblewrap build                       # → signed .aab + key), code:block6 (/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOO), FloodedArea — Google Play packaging (TWA) runbook, ⚠️ Hard ordering dependency — deploy before Phase 2 (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (34): EvacDetailCard(), EvacDetailCardProps, dateLabel(), M, WaterLevelModal(), WaterLevelModalProps, LatLng, DEPTH_TICKS (+26 more)

### Community 26 - "Community 26"
Cohesion: 0.26
Nodes (10): TurnstileWidget(), TurnstileWidgetProps, captchaEnabled(), getCaptchaToken(), loadScript(), loadTurnstile(), SITE_KEY, TURNSTILE_SITE_KEY (+2 more)

## Knowledge Gaps
- **186 isolated node(s):** `target`, `lib`, `module`, `skipLibCheck`, `moduleResolution` (+181 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `Community 8` to `Community 21`, `Community 3`, `Community 20`, `Community 5`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `Severity` connect `Community 20` to `Community 8`, `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `LatLng` connect `Community 23` to `Community 2`, `Community 5`, `Community 20`, `Community 21`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `target`, `lib`, `module` to the rest of the system?**
  _186 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06594071385359952 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07317073170731707 - nodes in this community are weakly interconnected._