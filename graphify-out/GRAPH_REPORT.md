# Graph Report - baha-ui  (2026-08-30)

## Corpus Check
- 104 files · ~222,976 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 934 nodes · 1998 edges · 53 communities (49 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `67a18ff0`
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
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 45 edges
2. `Severity` - 30 edges
3. `LatLng` - 27 edges
4. `t` - 24 edges
5. `App()` - 22 edges
6. `EnrichedReport` - 22 edges
7. `FloodReport` - 19 edges
8. `FloodProneArea` - 19 edges
9. `compilerOptions` - 18 edges
10. `tFormat()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `EvacDetailCard()` --calls--> `t`  [INFERRED]
  src/components/panels/EvacDetailCard.tsx → playstore-assets/seed.mjs
- `NotifyModal()` --calls--> `t`  [INFERRED]
  src/components/panels/NotifyModal.tsx → playstore-assets/seed.mjs
- `ReportDetailCard()` --calls--> `t`  [INFERRED]
  src/components/panels/ReportDetailCard.tsx → playstore-assets/seed.mjs
- `Sidebar()` --calls--> `t`  [INFERRED]
  src/components/panels/Sidebar.tsx → playstore-assets/seed.mjs
- `TopBar()` --calls--> `t`  [INFERRED]
  src/components/panels/TopBar.tsx → playstore-assets/seed.mjs

## Communities (53 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.17
Nodes (17): DEPTH_TICKS, ReportDetailCard(), ADVICE, DepthBand, DRAIN_CM_PER_HR, drainMinutes(), nearestTtlStop(), projectionRateCmPerHr() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (40): boot(), collectProps(), compileAttr(), compileTemplate(), createComponentFactory(), createExternalModules(), createHelmetManager(), createPseudoSheet() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (18): AdminRow, Field, FIELDS, FieldType, FormValues, inputStyle, levelOptions, roadOptions (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.20
Nodes (20): AdminPanelProps, Props, ReportDetailCardProps, AppSettings, BulkAlertResult, BulkWarnAreas, FeedbackStatus, Hotline (+12 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): dependencies, leaflet, react, react-dom, react-leaflet, @react-oauth/google, description, devDependencies (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (37): api, ApiError, buildQuery(), mutations, rawApi, useActivityStream(), AuthResponse, useAuth() (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (21): ActivityTicker(), AddStopSheet(), AdminWarnZoneModal(), AlertModal(), DepthReference(), LocationHelpModal(), PermissionNote(), PublicDashboardModal() (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.10
Nodes (20): FloodMapProps, MapFocus, ActivityTickerProps, ALERT_RANK, ResponseConsoleProps, TONE, AlertLevel, EvacuationCenter (+12 more)

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
Cohesion: 0.15
Nodes (18): NotifyPrefs, Option, OPTIONS, QuickReportSheetProps, VOICE_SPOKEN_KEY, Lang, Severity, DistrictHotspot (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (15): alerts, centers, feedback, floodProneAreas, hotlines, reports, rescues, settings (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): buildTime, env, pkg

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (23): FloodDigestModalProps, TripPanelProps, Trip, SEV_META, SEV_RANK, activityClause(), ALERT_NOTE, buildDigestXBody() (+15 more)

### Community 21 - "Community 21"
Cohesion: 0.17
Nodes (11): escapeHtml(), FloodMap(), pendingIcon(), searchIcon(), SearchMark, shelterIcon(), shelterIconHtml(), youIcon() (+3 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (17): code:nginx (location = /manifest.webmanifest {), code:bash (curl -sI https://floodedarea.com/manifest.webmanifest | grep), code:bash (curl -sI https://floodedarea.com/manifest.webmanifest), code:bash (npm install -g @bubblewrap/cli         # or use: npx @bubble), code:bash (bubblewrap build                       # → signed .aab + key), code:block6 (/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOO), FloodedArea — Google Play packaging (TWA) runbook, ⚠️ Hard ordering dependency — deploy before Phase 2 (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.06
Nodes (50): AddStopSheetProps, inputStyle, labelStyle, EvacDetailCard(), EvacDetailCardProps, MapPickFieldProps, loadMonitorRadiusKm(), LatLng (+42 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (43): geocodeCityBBox(), attempt(), bboxQuery(), findIntersection(), hasUsableElements(), Intersection, IntersectionOutcome, OVERPASS_ENDPOINTS (+35 more)

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (20): 1. ~~Sign the `.aab`~~ — ✅ done 2026-08-08, 2. ~~Publish a privacy policy~~ — ✅ done 2026-08-09, 2. ~~Publish a privacy policy~~ — ✅ done 2026-08-09, resynced 2026-08-15, 3. Play Console — create, upload, configure — **[you]**, 4. Start the closed test immediately after upload — **[you]**, 5. User-generated content compliance — **[you]** ⚠️ nothing started, 6. Add the app-signing fingerprint to `assetlinks.json` — **[claude]** (needs a value from you), 7. Manifest `Content-Type` — **[you]** (needs server access) (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.05
Nodes (42): buildContext(), GeoResult, nearViewbox(), NominatimAddress, NominatimReverseRow, NominatimRow, pickBarangay(), pickCity() (+34 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (19): ConditionPill(), PAGE_SIZE_OPTIONS, PublicDashboardModalProps, RADIUS_OPTIONS, RoadConditionsModalProps, WaterLevelModalProps, roadShort(), FloodReport (+11 more)

### Community 28 - "Community 28"
Cohesion: 0.14
Nodes (15): DEFAULT_NOTIFY_PREFS, fmtKm(), NotifyModal(), NotifyModalProps, SEV_ORDER, currentLang, getLang(), listeners (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.24
Nodes (14): FLOOD_HOTSPOTS, FloodHotspot, addCustomHotspot(), clearPin(), EMPTY, hasPinOverride(), isCustom(), loadHotspots() (+6 more)

### Community 30 - "Community 30"
Cohesion: 0.17
Nodes (15): Trend, observationAnchorMs(), projectDepth(), projectedSeries(), waterSeries(), IncidentCaptionInputs, localDateKey(), RecentReportRow (+7 more)

### Community 31 - "Community 31"
Cohesion: 0.19
Nodes (11): ALL, Choice, inputStyle, labelStyle, LEVEL_OPTIONS, cityOf(), ISLAND_GROUPS, IslandGroup (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.16
Nodes (13): roadFromDepth(), alertsForUser(), alertsInMonitorArea(), alreadyReportedKeys(), buildPossibleClosures(), buildRoadDirectory(), enrichReports(), inMonitorArea() (+5 more)

### Community 33 - "Community 33"
Cohesion: 0.25
Nodes (6): AGES, db, FALLBACK, here, now, SEED

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (9): added, CLUSTERS, db, kept, now, rand, ROADS, SEVERITIES (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (10): code:bash (# 1. Seed with fresh timestamps and start the stack (mock on), code:js (await window.__prepare({ zoom: 13 });   // locate, verify th), code:bash (# 1. Seed nationally and start the stack.), code:js (window.__prepare({ zoom: 6, centre: [11.2, 123.0] }).then(r ), code:bash (sips -c $((H * hFrac)) $((W * wFrac)) shot.jpg --out crop.jp), If you change the app, Play Store assets, Regenerating the screenshots (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (10): DEFAULT_OPEN, fmtRadius(), PanelKey, SectionKey, Sidebar(), SidebarProps, SUBHEAD, Tab (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.25
Nodes (7): chunk(), encode(), height, [out, ...slices], parts, px, SIG

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (8): App name — max 30, code:block1 (FloodedArea: PH Flood Watch), code:block2 (See which streets are flooded near you — live depths, road s), code:block3 (FloodedArea shows you where it is flooding right now in Metr), Full description — max 4000, Notes for the rest of the listing, Play Store listing copy — FloodedArea, Short description — max 80

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (3): 085-fix-monitoring-area-detection, Items, Review

### Community 40 - "Community 40"
Cohesion: 0.14
Nodes (16): severityFromDepth(), cmToIn(), formatDepth(), formatDepthShort(), formatDuration(), minutesSince(), timeAgo(), AdminQuickReportView() (+8 more)

### Community 41 - "Community 41"
Cohesion: 0.26
Nodes (9): canOpenInSystemBrowser(), detectInAppBrowser(), InAppApp, inAppLabel(), openInSystemBrowser(), detectHelpBucket(), GOOGLE_ENABLED, InAppSignInHelp() (+1 more)

### Community 42 - "Community 42"
Cohesion: 0.26
Nodes (10): TurnstileWidget(), TurnstileWidgetProps, captchaEnabled(), getCaptchaToken(), loadScript(), loadTurnstile(), SITE_KEY, TURNSTILE_SITE_KEY (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.18
Nodes (9): AlertModalProps, AlertSource, LEVEL_LABEL, SOURCE_KEY, LocationHelpModalProps, MsgKey, HelpBucket, locationHelpSteps() (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.36
Nodes (7): Props, inputStyle, labelStyle, LEVEL_OPTIONS, Props, FloodProneArea, WarnArea

### Community 46 - "Community 46"
Cohesion: 0.25
Nodes (8): dateLabel(), RescueChartModal(), RescueChartModalProps, STATUS_STYLE, DISTRICT_COLORS, RESCUE_STATUS_META, rescueCountsByDistrict(), rescuesOnLocalDate()

### Community 47 - "Community 47"
Cohesion: 0.50
Nodes (3): Claude Code — resume checkpoint, Plan (from TodoWrite state), To resume

### Community 48 - "Community 48"
Cohesion: 0.38
Nodes (5): useReportHistory(), dateLabel(), M, WaterLevelModal(), DEPTH_TICKS

### Community 49 - "Community 49"
Cohesion: 0.40
Nodes (4): FeedbackFormModalProps, TYPES, FeedbackType, NewFeedback

### Community 50 - "Community 50"
Cohesion: 0.50
Nodes (3): AlertRibbonProps, LEVEL_STYLE, FloodAlert

### Community 51 - "Community 51"
Cohesion: 0.50
Nodes (3): NET_GLYPH, ShareModalProps, ShareLink

## Knowledge Gaps
- **296 isolated node(s):** `target`, `lib`, `module`, `skipLibCheck`, `moduleResolution` (+291 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `Community 6` to `Community 0`, `Community 36`, `Community 5`, `Community 40`, `Community 41`, `Community 43`, `Community 45`, `Community 13`, `Community 51`, `Community 20`, `Community 23`, `Community 24`, `Community 26`, `Community 27`, `Community 28`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `Severity` connect `Community 13` to `Community 0`, `Community 32`, `Community 3`, `Community 36`, `Community 5`, `Community 20`, `Community 24`, `Community 27`, `Community 28`, `Community 30`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `t` connect `Community 6` to `Community 0`, `Community 33`, `Community 36`, `Community 5`, `Community 41`, `Community 23`, `Community 26`, `Community 28`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 23 inferred relationships involving `t` (e.g. with `ActivityTicker()` and `AddStopSheet()`) actually correct?**
  _`t` has 23 INFERRED edges - model-reasoned connections that need verification._
- **What connects `target`, `lib`, `module` to the rest of the system?**
  _296 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._