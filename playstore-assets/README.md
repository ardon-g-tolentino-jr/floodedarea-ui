# Play Store assets

Everything Play Console asks for in the **store listing** step, plus the tooling that regenerates
it. Companion to [`../PLAYSTORE_TODO.md`](../PLAYSTORE_TODO.md) (what is still outstanding) and
[`../PLAYSTORE_PACKAGE.md`](../PLAYSTORE_PACKAGE.md) (the TWA build runbook).

Nothing here ships in the app. `frame.html` is served off the Vite dev server during a capture
and is never part of `dist/`.

## What is here

| Path | What it is | Play requirement |
|---|---|---|
| `out/icon/app-icon-512.png` | App icon | 512×512 PNG, no alpha ✅ |
| `out/feature-graphic/feature-graphic-1024x500.jpg` | Feature graphic | 1024×500 ✅ |
| `out/screenshots/phone/*.png` | 6 phone screenshots | ≥2 required; 1080×1920 (9:16), each side within 320–3840 ✅ |
| `listing.md` | Title, short & full description, and listing notes | ≤30 / ≤80 / ≤4000 chars ✅ |
| `out/.screenshot-db.json` | Curated demo content the screenshots are taken against | — |
| `frame.html`, `seed.mjs`, `compose.mjs` | The capture pipeline | — |

The screenshots, in order:

1. `01-map-alert` — live map, rainfall warning, "you are in a flood-affected area" with the ETA.
2. `02-nearby-reports` — the nearby list: depth, trend, road status, confirmations, expiry.
3. `03-report-detail` — one report in full: depth gauge, 6-hour trend, confirm and share.
4. `04-report-flood` — how little it takes to file a report.
5. `05-evacuation-centers` — shelters on the map with distance, directions and a call button.
6. `06-emergency-sos` — the rescue request and the hotline list.

## Regenerating the screenshots

Three things have to be true at capture time, and each has a piece of tooling behind it.

**1. The data has to be minutes old.** Reports expire on a severity-scaled TTL (20/45/90 min —
`REPORT_TTL_MIN` in `src/utils/viewModel.ts`), so a seed file written an hour ago renders an
empty map, honestly. `seed.mjs` re-stamps the curated content with times relative to now.

**2. The location has to be the demo one.** The capture machine's real position would otherwise
be published in the "You" marker. `frame.html` overrides geolocation to a fixed point in
Concepcion Uno, Marikina, and `__prepare()` **refuses to continue** if the app is not using it.

**3. The frame has to be a phone.** The capture window is shorter than 9:16, so the app is laid
out at a true 540×960 inside an iframe and scaled to fit; the capture tool caps a returned image
at ~1.2 MP, so the frame is grabbed in two halves at native retina resolution and stitched.

```bash
# 1. Seed with fresh timestamps and start the stack (mock on :3001, Vite on :5188).
node playstore-assets/seed.mjs /tmp/shots-db.json
MOCK_DB=/tmp/shots-db.json node mock-api/server.cjs &
VITE_API_URL=http://localhost:3001 npx vite --port 5188 --strictPort &

# 2. Open the capture frame and prepare it (see below).
open http://localhost:5188/playstore-assets/frame.html

# 3. Stitch the two halves and normalise to 1080x1920.
node playstore-assets/compose.mjs /tmp/shot.png top.png bottom.png
sips -z 1920 1080 /tmp/shot.png --out playstore-assets/out/screenshots/phone/NN-name.png
```

In the frame's console, before every capture:

```js
await window.__prepare({ zoom: 13 });   // locate, verify the demo fix, frame the map, settle tiles
```

Other helpers on the frame window: `__setZoom(z)` (absolute, read off the tile URLs — the tile
layer runs a zoom offset, so calibrate by eye), `__centreOnYou()`, `__panBy(dx, dy)`,
`__mapZoom()`.

Then capture the stage twice — the top half and the bottom half — and stitch. If the app is
signed in, sign out first: these are citizen-facing screenshots and an admin session changes the
top bar and the report flow.

## If you change the app

Re-shoot. Store screenshots that no longer match the app are a review risk, and the descriptions
in `listing.md` make specific claims about behaviour — depths in centimetres, reports expiring,
guest reporting, English and Filipino. Keep them true.
