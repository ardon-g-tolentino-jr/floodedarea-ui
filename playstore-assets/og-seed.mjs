// Scatter extra flood reports nationwide, on top of a database already written by `seed.mjs`.
//
// The curated screenshot seed is Marikina-only — correct for the Play Store phone shots, which are
// framed at street level, but at the archipelago-wide zoom the social cover uses it renders as a
// single speck on Luzon and an otherwise empty country. The cover is meant to read as *national*
// coverage, so this pass adds report clusters in the Visayas and Mindanao.
//
//   node playstore-assets/seed.mjs    /tmp/og-db.json   # curated content, fresh timestamps
//   node playstore-assets/og-seed.mjs /tmp/og-db.json   # + nationwide scatter, in place
//
// Runs in place and is idempotent: reports it adds are tagged `ogScatter`, and a re-run replaces
// them rather than stacking a second copy. `seed.mjs` is left untouched, so the Play Store
// pipeline is unaffected.
//
// These are illustrative markers for cover art, not claims about real conditions — they exist only
// in the local mock database and are never served to anyone.

import { readFile, writeFile } from 'node:fs/promises';

const out = process.argv[2];
if (!out) {
  console.error('usage: node playstore-assets/og-seed.mjs <db.json written by seed.mjs>');
  process.exit(1);
}

// Cluster anchors across the three island groups, each with a rough spread in degrees. Positions
// are city-approximate — at zoom 6 a tenth of a degree is a couple of pixels, and the cover blurs
// the map anyway; what matters is that the dots land on land, in the right regions.
const CLUSTERS = [
  // Northern Luzon — above the alert card's top edge, which is the only clear band in the upper
  // half of the frame. Without these the whole north of the country reads as unwatched.
  { area: 'Cagayan', district: 'Tuguegarao, Cagayan', lat: 17.61, lon: 121.73, n: 6 },
  { area: 'Isabela', district: 'Ilagan, Isabela', lat: 17.13, lon: 121.89, n: 5 },
  { area: 'Ilocos Sur', district: 'Vigan, Ilocos Sur', lat: 17.57, lon: 120.39, n: 5 },
  { area: 'La Union', district: 'San Fernando, La Union', lat: 16.62, lon: 120.32, n: 4 },
  { area: 'Nueva Vizcaya', district: 'Bayombong, Nueva Vizcaya', lat: 16.48, lon: 121.15, n: 4 },
  // Central and southern Luzon.
  { area: 'Pangasinan', district: 'Dagupan, Pangasinan', lat: 16.04, lon: 120.34, n: 7 },
  { area: 'Nueva Ecija', district: 'Cabanatuan, Nueva Ecija', lat: 15.49, lon: 120.97, n: 6 },
  { area: 'Tarlac', district: 'Tarlac City, Tarlac', lat: 15.49, lon: 120.6, n: 5 },
  { area: 'Pampanga', district: 'San Fernando, Pampanga', lat: 15.03, lon: 120.69, n: 9 },
  { area: 'Bulacan', district: 'Calumpit, Bulacan', lat: 14.92, lon: 120.76, n: 8 },
  { area: 'Rizal', district: 'Cainta, Rizal', lat: 14.58, lon: 121.12, n: 7 },
  { area: 'Laguna', district: 'Santa Cruz, Laguna', lat: 14.28, lon: 121.42, n: 7 },
  { area: 'Batangas', district: 'Batangas City, Batangas', lat: 13.76, lon: 121.06, n: 5 },
  { area: 'Quezon', district: 'Lucena, Quezon', lat: 13.93, lon: 121.62, n: 4 },
  { area: 'Camarines Sur', district: 'Naga, Camarines Sur', lat: 13.62, lon: 123.19, n: 6 },
  { area: 'Albay', district: 'Legazpi, Albay', lat: 13.14, lon: 123.74, n: 5 },
  // Visayas.
  { area: 'Iloilo', district: 'Iloilo City, Iloilo', lat: 10.72, lon: 122.56, n: 6 },
  { area: 'Negros Occidental', district: 'Bacolod, Negros Occidental', lat: 10.67, lon: 122.95, n: 5 },
  { area: 'Cebu', district: 'Cebu City, Cebu', lat: 10.32, lon: 123.89, n: 6 },
  { area: 'Bohol', district: 'Tagbilaran, Bohol', lat: 9.65, lon: 123.85, n: 3 },
  { area: 'Leyte', district: 'Tacloban, Leyte', lat: 11.24, lon: 125.0, n: 4 },
  { area: 'Samar', district: 'Catbalogan, Samar', lat: 11.78, lon: 124.88, n: 3 },
  // Mindanao — sits in the clear band below the alert card, so it carries the bottom of the frame.
  { area: 'Misamis Oriental', district: 'Cagayan de Oro, Misamis Oriental', lat: 8.48, lon: 124.65, n: 7 },
  { area: 'Agusan del Norte', district: 'Butuan, Agusan del Norte', lat: 8.95, lon: 125.54, n: 5 },
  { area: 'Lanao del Norte', district: 'Iligan, Lanao del Norte', lat: 8.23, lon: 124.24, n: 4 },
  { area: 'Davao del Sur', district: 'Davao City, Davao del Sur', lat: 7.09, lon: 125.6, n: 9 },
  { area: 'Cotabato', district: 'Cotabato City, Maguindanao del Norte', lat: 7.21, lon: 124.25, n: 6 },
  { area: 'South Cotabato', district: 'General Santos, South Cotabato', lat: 6.12, lon: 125.18, n: 7 },
  { area: 'Zamboanga', district: 'Zamboanga City, Zamboanga del Sur', lat: 6.92, lon: 122.08, n: 4 },
];

// Degrees. A first pass at 0.16 packed each cluster into a couple of pixels at zoom 6, which the
// cover's blur then erased; at 0.28 a cluster spans a city and its outskirts and survives as a
// recognisable cluster of dots rather than one smudge.
const SPREAD = 0.28;
const SEVERITIES = ['high', 'medium', 'medium', 'low'];
const TRENDS = ['rising', 'steady', 'receding'];
const ROADS = ['impassable', 'risky', 'passable'];

// Deterministic PRNG (mulberry32) — the same seed gives the same scatter every run, so a
// re-captured cover is comparable to the last one instead of being a fresh random layout.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const db = JSON.parse(await readFile(out, 'utf8'));
const kept = db.reports.filter((r) => !r.ogScatter);
const now = Date.now();
const ago = (min) => new Date(now - min * 60_000).toISOString();

const rand = rng(20260814);
let id = Math.max(0, ...kept.map((r) => r.id)) + 1;
const added = [];

for (const c of CLUSTERS) {
  for (let i = 0; i < c.n; i++) {
    const severity = SEVERITIES[Math.floor(rand() * SEVERITIES.length)];
    // Stay well inside each severity's TTL (20/45/90 min in viewModel.ts) so every dot is still
    // live when the capture runs a few minutes after seeding.
    const confirmed = severity === 'low' ? 4 + rand() * 8 : severity === 'medium' ? 6 + rand() * 16 : 8 + rand() * 30;
    added.push({
      id: id++,
      name: `${c.area} report ${i + 1}`,
      district: c.district,
      latitude: +(c.lat + (rand() - 0.5) * SPREAD).toFixed(4),
      longitude: +(c.lon + (rand() - 0.5) * SPREAD).toFixed(4),
      severity,
      depthCm: severity === 'high' ? 90 + Math.round(rand() * 60) : severity === 'medium' ? 40 + Math.round(rand() * 40) : 12 + Math.round(rand() * 20),
      trend: TRENDS[Math.floor(rand() * TRENDS.length)],
      road: ROADS[Math.floor(rand() * ROADS.length)],
      reportsCount: 2 + Math.round(rand() * 20),
      status: 'active',
      reporterUserId: null,
      ogScatter: true, // marks this row as cover-art filler so a re-run can replace it
      createdAt: ago(confirmed + 20 + rand() * 60),
      updatedAt: ago(confirmed),
    });
  }
}

db.reports = [...kept, ...added];
await writeFile(out, JSON.stringify(db, null, 2));
console.log(`og-seed: ${kept.length} curated + ${added.length} scattered = ${db.reports.length} reports across ${CLUSTERS.length} clusters`);
