// Rebuild the screenshot mock database with timestamps relative to *now*.
//
// Flood reports expire fast by design — REPORT_TTL_MIN in src/utils/viewModel.ts gives a report
// 20 min (low) / 45 (medium) / 90 (high) from its `updatedAt` before `enrichReports` marks it
// expired and it drops off the map. A seed file with fixed timestamps is therefore only usable
// for a few minutes after it is written; every capture run has to re-stamp it, or the app
// truthfully renders an empty map.
//
//   node playstore-assets/seed.mjs <output.json>
//
// Reads playstore-assets/out/.screenshot-db.json (the curated content — places, depths, wording)
// and writes a copy with fresh timestamps to <output.json>, which the mock server then serves via
// $MOCK_DB. The curated seed itself is never modified.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(here, 'out', '.screenshot-db.json');

const out = process.argv[2];
if (!out) {
  console.error('usage: node playstore-assets/seed.mjs <output.json>');
  process.exit(1);
}

const now = Date.now();
const ago = (min) => new Date(now - min * 60_000).toISOString();

// Per-report ages, in minutes: [first reported, last confirmed]. The second number is what the
// TTL counts from, so it is kept well inside each severity's window; the gap between the two is
// what makes a report read as "reported an hour ago, still being confirmed".
const AGES = {
  1: [74, 14], // San Mateo Bridge — high
  2: [52, 6], //  Tumana — high, the deepest and most-confirmed
  3: [38, 11], // Concepcion Uno — medium
  4: [61, 9], //  Provident Village — high
  5: [29, 17], // Riverbanks Center — medium
  6: [44, 22], // Rosario — medium
  7: [16, 7], //  Santolan — low
  8: [12, 5], //  Cainta Junction — low
  9: [260, 215], // Marikina Heights — resolved
  10: [33, 13], // Nangka — medium
  11: [300, 190], // Malanday — resolved
  12: [26, 19], // Sto. Niño — medium
};
const FALLBACK = { low: [14, 6], medium: [35, 15], high: [58, 12] };

const db = JSON.parse(await readFile(SEED, 'utf8'));

db.reports = db.reports.map((r) => {
  const [reported, confirmed] = AGES[r.id] ?? FALLBACK[r.severity] ?? FALLBACK.medium;
  return { ...r, createdAt: ago(reported), updatedAt: ago(confirmed) };
});

// The rainfall warning: raised within the hour, last amended a few minutes ago.
db.alerts = db.alerts.map((a) => ({ ...a, createdAt: ago(47), updatedAt: ago(9) }));

// Pending rescue requests, newest first — the admin queue reads as live.
db.rescues = db.rescues.map((r, i) => {
  const t = ago(4 + i * 7);
  return { ...r, createdAt: t, updatedAt: t };
});

db.feedback = db.feedback.map((f, i) => {
  const t = ago(90 + i * 55);
  return { ...f, createdAt: t, updatedAt: t };
});

// Shelter occupancy is being updated through the event; one zone was warned this hour.
db.centers = db.centers.map((c) => ({ ...c, updatedAt: ago(21) }));
db.floodProneAreas = db.floodProneAreas.map((z, i) => ({
  ...z,
  updatedAt: ago(35),
  lastWarnedAt: i === 0 ? ago(28) : z.lastWarnedAt,
}));

await writeFile(out, JSON.stringify(db, null, 2));
console.log(`seeded ${out} — ${db.reports.length} reports, ${db.alerts.length} alert(s) @ ${new Date(now).toISOString()}`);
