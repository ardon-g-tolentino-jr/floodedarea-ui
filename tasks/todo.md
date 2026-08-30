# 085-fix-monitoring-area-detection

Defect: widening the "Monitoring area" slider does not make the app detect an overlapping
flood report. Three surfaces read the monitoring area differently and all three are wrong.

## Items

- [x] 1. `viewModel.ts`: add `inMonitorArea(r, radiusKm)` overlap predicate (`edgeKm <= radiusKm`)
- [x] 2. `viewModel.ts`: `computeStatus` takes `radiusKm`; drop hardcoded 2.5 km / 3 km
- [x] 3. `App.tsx`: persist `monitorRadiusKm` (`baha_monitor_v1`), clamp + migrate from notify prefs
- [x] 4. `NotifyModal.tsx`: drop `NotifyPrefs.radiusKm` + its slider; read-only range line instead
- [x] 5. `App.tsx`/`Sidebar.tsx`: rewire every `notifyPrefs.radiusKm` reader to `monitorRadiusKm`
- [x] 6. `App.tsx`: overlap matching at Nearby (:559), banner (:578), alerts (:638)
- [x] 7. `App.tsx`: split `seenReportIds` into `knownReportIds` + `notifiedReportIds`
- [x] 8. `App.tsx`: new debounced widen-backfill effect, one summary toast
- [x] 9. `i18n.ts`: retemplate `status.clearLine`, add `notify.areaWidened`, drop `notify.withinDistance`
- [x] 10. `npm run typecheck` clean
- [x] 11. Manual verification against mock data (see plan)
- [x] 12. `npm run build`, commit `dist/`, bump to 1.68.1
- [x] 13. CHANGELOG entry in the backend repo

## Review

Three stacked bugs behind one gesture, all fixed:

1. **Two radii.** The sidebar `MONITORING AREA` slider drove the map circle + Nearby; the 🔔 Flood
   alerts dialog had its own slider, and only *that* one gated alerts. Unified to one persisted
   radius (`baha_monitor_v1`, clamped, migrates the old `notifyPrefs.radiusKm` forward).
2. **Ids burned before filtering.** `seenReportIds` consumed every id on arrival, before the
   radius test — so a report that arrived out of range could never be surfaced by widening. Split
   into `knownReportIds` (arrival) + `notifiedReportIds` (dedupe). Priming now marks only reports
   already inside the circle, which is what makes the reported case work.
3. **Centre-pin matching.** New `inMonitorArea` (`edgeKm <= radiusKm`) = true ring overlap, reusing
   the `edgeKm` `enrichReports` already computed and the idiom `alertsInMonitorArea` already used
   for admin warnings. Applied to Nearby, the banner and the alert arm.

Bonus: `computeStatus` ignored the slider entirely (hardcoded 2.5/3 km) — now takes the radius.
New debounced widen-backfill effect toasts one summary for what a widen brings into range.

**Proof:** scratch harness over the seed reports at the default userLoc — ring overlap catches
reports the centre-pin test misses at 2/3/3.2/4 km; load-at-1 km then widen-to-5 km gives 0 reports
on `main` vs 6 on this branch. typecheck + build clean.

**Still owed:** browser pass (Chrome extension was not connected this session).
