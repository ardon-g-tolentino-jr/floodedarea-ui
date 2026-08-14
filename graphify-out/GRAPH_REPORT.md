# Graph Report - baha-ui  (2026-08-14)

## Corpus Check
- 95 files · ~208,321 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 856 nodes · 1801 edges · 45 communities (42 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bdcd3fe7`
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

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 45 edges
2. `Severity` - 30 edges
3. `LatLng` - 25 edges
4. `t` - 23 edges
5. `App()` - 22 edges
6. `EnrichedReport` - 20 edges
7. `FloodProneArea` - 19 edges
8. `compilerOptions` - 18 edges
9. `FloodReport` - 17 edges
10. `FloodAlert` - 17 edges

## Surprising Connections (you probably didn't know these)
- `ActivityTicker()` --calls--> `t`  [INFERRED]
  src/components/panels/ActivityTicker.tsx → playstore-assets/seed.mjs
- `EvacDetailCard()` --calls--> `t`  [INFERRED]
  src/components/panels/EvacDetailCard.tsx → playstore-assets/seed.mjs
- `NotifyModal()` --calls--> `t`  [INFERRED]
  src/components/panels/NotifyModal.tsx → playstore-assets/seed.mjs
- `ReportDetailCard()` --calls--> `t`  [INFERRED]
  src/components/panels/ReportDetailCard.tsx → playstore-assets/seed.mjs
- `ShareModal()` --calls--> `t`  [INFERRED]
  src/components/panels/ShareModal.tsx → playstore-assets/seed.mjs

## Communities (45 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (15): inputStyle, labelStyle, Props, SEV_ORDER, DEPTH_RANGE, DepthBand, DRAIN_CM_PER_HR, RAIN_CM_PER_HR (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (40): boot(), collectProps(), compileAttr(), compileTemplate(), createComponentFactory(), createExternalModules(), createHelmetManager(), createPseudoSheet() (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (50): AdminPanelProps, AdminRow, Field, FIELDS, FieldType, FormValues, inputStyle, levelOptions (+42 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (32): api, buildQuery(), buildContext(), GeoResult, nearViewbox(), NominatimAddress, NominatimReverseRow, NominatimRow (+24 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): dependencies, leaflet, react, react-dom, react-leaflet, @react-oauth/google, description, devDependencies (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (36): mutations, rawApi, useActivityStream(), useIsMobile(), useAcceptedFeatures(), useAcceptedFeedback(), useAlerts(), useAllFeedback() (+28 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (19): AddStopSheet(), AdminWarnZoneModal(), AlertModal(), DepthReference(), LocationHelpModal(), PermissionNote(), PublicDashboardModal(), QuickReportSheet() (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, exactOptionalPropertyTypes, isolatedModules, jsx, lib, module, moduleDetection (+11 more)

### Community 8 - "Community 8"
Cohesion: 0.17
Nodes (11): ConditionPill(), currentLang, getLang(), listeners, MESSAGES, roadLabel(), roadShort(), sevLabel() (+3 more)

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
Cohesion: 0.12
Nodes (17): Option, OPTIONS, QuickReportSheetProps, VOICE_SPOKEN_KEY, Lang, getRecognitionCtor(), listenForSeverity(), ListenForSeverityOptions (+9 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (15): alerts, centers, feedback, floodProneAreas, hotlines, reports, rescues, settings (+7 more)

### Community 15 - "Community 15"
Cohesion: 0.50
Nodes (3): buildTime, env, pkg

### Community 20 - "Community 20"
Cohesion: 0.13
Nodes (21): FloodDigestModalProps, AlertLevel, activityClause(), ALERT_NOTE, buildDigestXBody(), buildFloodDigest(), buildReportOgUrl(), buildReportShareText() (+13 more)

### Community 21 - "Community 21"
Cohesion: 0.06
Nodes (43): ApiError, escapeHtml(), FloodMap(), FloodMapProps, MapFocus, pendingIcon(), searchIcon(), shelterIcon() (+35 more)

### Community 22 - "Community 22"
Cohesion: 0.14
Nodes (17): code:nginx (location = /manifest.webmanifest {), code:bash (curl -sI https://floodedarea.com/manifest.webmanifest | grep), code:bash (curl -sI https://floodedarea.com/manifest.webmanifest), code:bash (npm install -g @bubblewrap/cli         # or use: npx @bubble), code:bash (bubblewrap build                       # → signed .aab + key), code:block6 (/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOO), FloodedArea — Google Play packaging (TWA) runbook, ⚠️ Hard ordering dependency — deploy before Phase 2 (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.05
Nodes (51): AddStopSheetProps, inputStyle, labelStyle, EvacDetailCard(), EvacDetailCardProps, MapPickFieldProps, TripPanelProps, LatLng (+43 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (18): geocodeCityBBox(), attempt(), bboxQuery(), findIntersection(), hasUsableElements(), Intersection, IntersectionOutcome, OVERPASS_ENDPOINTS (+10 more)

### Community 25 - "Community 25"
Cohesion: 0.10
Nodes (19): 1. ~~Sign the `.aab`~~ — ✅ done 2026-08-08, 2. ~~Publish a privacy policy~~ — ✅ done 2026-08-09, 3. Play Console — create, upload, configure — **[you]**, 4. Start the closed test immediately after upload — **[you]**, 5. User-generated content compliance — **[you]** ⚠️ nothing started, 6. Add the app-signing fingerprint to `assetlinks.json` — **[claude]** (needs a value from you), 7. Manifest `Content-Type` — **[you]** (needs server access), 8. Deliverables + docs housekeeping — **[claude]** (+11 more)

### Community 26 - "Community 26"
Cohesion: 0.26
Nodes (10): TurnstileWidget(), TurnstileWidgetProps, captchaEnabled(), getCaptchaToken(), loadScript(), loadTurnstile(), SITE_KEY, TURNSTILE_SITE_KEY (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (17): roadFromDepth(), pointAt(), snapToRoad(), alertsForUser(), alertsInMonitorArea(), buildPossibleClosures(), buildRoadDirectory(), districtHotspots() (+9 more)

### Community 28 - "Community 28"
Cohesion: 0.19
Nodes (11): ALL, Choice, inputStyle, labelStyle, LEVEL_OPTIONS, cityOf(), ISLAND_GROUPS, IslandGroup (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.22
Nodes (12): PAGE_SIZE_OPTIONS, PublicDashboardModalProps, RADIUS_OPTIONS, RoadConditionsModalProps, FloodReport, TREND_META, closuresNearLocation(), DistrictRoads (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (14): Trend, observationAnchorMs(), projectDepth(), projectedSeries(), IncidentCaptionInputs, localDateKey(), RecentReportRow, buildDailyWaterBars() (+6 more)

### Community 31 - "Community 31"
Cohesion: 0.19
Nodes (11): AdminReportIncidentModal(), inputStyle, labelStyle, SEV_ORDER, SEV_TO_LEVEL, SOURCE_OPTIONS, TTL_OPTIONS, fileToCompressedDataUrl() (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.18
Nodes (11): DEFAULT_OPEN, fmtRadius(), PanelKey, SectionKey, Sidebar(), SidebarProps, SUBHEAD, Tab (+3 more)

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (11): DEPTH_TICKS, ReportDetailCard(), ADVICE, projectionRateCmPerHr(), sparkPaths(), trendNote(), waterSeries(), affectedRadiusKm() (+3 more)

### Community 34 - "Community 34"
Cohesion: 0.17
Nodes (9): added, CLUSTERS, db, kept, now, rand, ROADS, SEVERITIES (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (10): code:bash (# 1. Seed with fresh timestamps and start the stack (mock on), code:js (await window.__prepare({ zoom: 13 });   // locate, verify th), code:bash (# 1. Seed nationally and start the stack.), code:js (window.__prepare({ zoom: 6, centre: [11.2, 123.0] }).then(r ), code:bash (sips -c $((H * hFrac)) $((W * wFrac)) shot.jpg --out crop.jp), If you change the app, Play Store assets, Regenerating the screenshots (+2 more)

### Community 36 - "Community 36"
Cohesion: 0.24
Nodes (8): Props, Option, OPTIONS, SeverityPickerProps, ZoneReportOptions, Severity, depthReference(), DistrictHotspot

### Community 37 - "Community 37"
Cohesion: 0.25
Nodes (7): chunk(), encode(), height, [out, ...slices], parts, px, SIG

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (8): App name — max 30, code:block1 (FloodedArea: PH Flood Watch), code:block2 (See which streets are flooded near you — live depths, road s), code:block3 (FloodedArea shows you where it is flooding right now in Metr), Full description — max 4000, Notes for the rest of the listing, Play Store listing copy — FloodedArea, Short description — max 80

### Community 39 - "Community 39"
Cohesion: 0.32
Nodes (6): LocationHelpModalProps, MsgKey, detectHelpBucket(), HelpBucket, locationHelpSteps(), STEPS

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (6): dateLabel(), M, WaterLevelModal(), WaterLevelModalProps, DEPTH_TICKS, SEV_META

### Community 41 - "Community 41"
Cohesion: 0.25
Nodes (6): AGES, db, FALLBACK, here, now, SEED

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (6): DEFAULT_NOTIFY_PREFS, fmtKm(), NotifyModal(), NotifyModalProps, NotifyPrefs, SEV_ORDER

### Community 43 - "Community 43"
Cohesion: 0.38
Nodes (5): NET_GLYPH, ShareModal(), ShareModalProps, tFormat(), ShareLink

## Knowledge Gaps
- **278 isolated node(s):** `target`, `lib`, `module`, `skipLibCheck`, `moduleResolution` (+273 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `Community 6` to `Community 32`, `Community 33`, `Community 2`, `Community 3`, `Community 36`, `Community 5`, `Community 39`, `Community 8`, `Community 42`, `Community 43`, `Community 13`, `Community 21`, `Community 23`, `Community 29`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `Severity` connect `Community 36` to `Community 32`, `Community 0`, `Community 2`, `Community 5`, `Community 8`, `Community 42`, `Community 13`, `Community 20`, `Community 23`, `Community 27`, `Community 29`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `t` connect `Community 6` to `Community 32`, `Community 33`, `Community 3`, `Community 5`, `Community 41`, `Community 42`, `Community 43`, `Community 21`, `Community 23`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `t` (e.g. with `ActivityTicker()` and `AddStopSheet()`) actually correct?**
  _`t` has 22 INFERRED edges - model-reasoned connections that need verification._
- **What connects `target`, `lib`, `module` to the rest of the system?**
  _278 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06918238993710692 - nodes in this community are weakly interconnected._