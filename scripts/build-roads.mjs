// Regenerates public/roads.json — the bundled OSM road network the app snaps flood reports to
// (see src/utils/roadSnap.ts). Roads are fetched from the OSM Overpass API in small tiles, because
// one large request times out (504), and merged + minified (named ways only, 5-decimal coords).
//
// Run:   node scripts/build-roads.mjs
// Needs: curl on PATH (Node's fetch gets 406'd by Overpass; curl works).
//
// COVERAGE: defaults to the Marikina–San Mateo valley where reports cluster today. To widen, grow
// BBOX and keep STEP small (~0.05°); Overpass 504s on big boxes, and firing many tiles too fast
// gets you rate-limited — keep the sleep generous. Region-wide (all of Metro Manila + Rizal) is
// ~6 MB major-roads-only; drop `residential` from CLASSES if you go that wide.

import { writeFileSync } from 'node:fs';
import { execFileSync, execSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const OUT = new URL('../public/roads.json', import.meta.url);
const BBOX = { W: 121.05, S: 14.55, E: 121.15, N: 14.75 };
const STEP = 0.05; // ~5.5 km tiles
const CLASSES = 'motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street';
const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const r5 = (n) => Math.round(n * 1e5) / 1e5;

function fetchTile(s, w, n, e, attempt = 1) {
  const q = `[out:json][timeout:90];(way["highway"~"^(${CLASSES})$"](${s},${w},${n},${e}););out geom;`;
  try {
    const out = execFileSync('curl', ['-s', '-m', '150', '--data-urlencode', `data=${q}`, ENDPOINT], { maxBuffer: 1 << 30 });
    return JSON.parse(out).elements || [];
  } catch (err) {
    if (attempt < 3) { console.log(`  retry ${attempt} (${String(err.message).slice(0, 60)})`); execSync('sleep 8'); return fetchTile(s, w, n, e, attempt + 1); }
    console.log(`  FAILED tile ${s},${w} — skipping`);
    return [];
  }
}

const ways = new Map();
let tile = 0;
const cols = Math.round((BBOX.E - BBOX.W) / STEP);
const rows = Math.round((BBOX.N - BBOX.S) / STEP);
for (let c = 0; c < cols; c++) {
  for (let r = 0; r < rows; r++) {
    tile++;
    const w = +(BBOX.W + c * STEP).toFixed(4), e = +(BBOX.W + (c + 1) * STEP).toFixed(4);
    const s = +(BBOX.S + r * STEP).toFixed(4), n = +(BBOX.S + (r + 1) * STEP).toFixed(4);
    process.stdout.write(`tile ${tile}/${cols * rows} (${s},${w})… `);
    const els = fetchTile(s, w, n, e);
    for (const el of els) if (el.type === 'way') ways.set(el.id, el);
    console.log(`+${els.length} (total ${ways.size})`);
    execSync('sleep 4');
  }
}

let id = 0;
const roads = [];
for (const w of ways.values()) {
  if (!w.tags || !w.tags.name || !w.geometry || w.geometry.length < 2) continue;
  roads.push({ i: id++, n: w.tags.name, h: w.tags.highway, c: w.geometry.map((g) => [r5(g.lon), r5(g.lat)]) });
}
const json = JSON.stringify({ generated: new Date().toISOString(), bbox: [BBOX.W, BBOX.S, BBOX.E, BBOX.N], roads });
writeFileSync(OUT, json);
console.log(`\nWROTE ${OUT.pathname}`);
console.log(`roads: ${roads.length} · raw ${(json.length / 1048576).toFixed(2)}MB · gz ${(gzipSync(json).length / 1024).toFixed(0)}KB`);
