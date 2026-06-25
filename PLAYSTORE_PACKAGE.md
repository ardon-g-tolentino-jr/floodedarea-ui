# FloodedArea — Google Play packaging (TWA) runbook

Goal: publish FloodedArea to Google Play **without forking the codebase** by wrapping the live
site `https://floodedarea.com/` in a **Trusted Web Activity (TWA)** built with **Bubblewrap**.
The website stays the single source of truth; content updates ship via the web with no Play
review in the loop.

Spec of record: `../baha-api/PLAYSTORE_PACKAGE_REQUIREMENTS.md`.

---

## What is done in this repo (Phase 1 — PWA readiness) ✅

A TWA requires the site to be an installable PWA. This branch (`playstore-package`) adds that:

- `vite-plugin-pwa` (dev dependency) configured in `vite.config.ts` with `registerType:
  'autoUpdate'` and a full web app manifest.
- Manifest (built to `dist/manifest.webmanifest`, served at
  `https://floodedarea.com/manifest.webmanifest`):
  - `name` "FloodedArea — Flood Watch", `short_name` "FloodedArea"
  - `start_url` / `scope` `/`, `display` `standalone`
  - `theme_color` `#0ea5e9`, `background_color` `#f4f7f9`
- Icons in `public/` (PNG), generated from the brand `favicon.svg`:
  - `pwa-192x192.png`, `pwa-512x512.png` (purpose `any`)
  - `pwa-maskable-512x512.png` (purpose `maskable`, full-bleed gradient, motif in the safe zone)
  - Source SVGs kept for regeneration: `public/icon.svg`, `public/icon-maskable.svg`
- A service worker (`dist/sw.js`) precaching the app shell. Large static data (`roads.json`,
  audio, share/QR images) is fetched at runtime, not precached.
- `index.html`: `theme-color` meta + apple-touch-icon.
- `.gitignore`: ignores `*.jks`, `*.keystore`, `key.properties` (signing secrets never committed).

Verify locally: `npm run build` → confirm `dist/manifest.webmanifest`, `dist/sw.js`, and
`dist/pwa-*.png` exist.

### ⚠️ Hard ordering dependency — deploy before Phase 2

**Bubblewrap reads the manifest from the production URL.** This branch must be merged and the
site **redeployed** so that `https://floodedarea.com/manifest.webmanifest` resolves live
**before** running `bubblewrap init`. Confirm with:

```bash
curl -sI https://floodedarea.com/manifest.webmanifest   # expect 200, Content-Type ...manifest
```

---

## Remaining steps (run after the site is redeployed)

These need Android tooling (JDK 17 + Android SDK build-tools; Bubblewrap can install/manage its
own on first run) and the live manifest. They are **not** run automatically.

### Phase 2 — Initialize the TWA

```bash
npm install -g @bubblewrap/cli         # or use: npx @bubblewrap/cli
bubblewrap init --manifest https://floodedarea.com/manifest.webmanifest
```

During init set:

| Field            | Value |
|------------------|-------|
| Application ID   | `com.floodedarea.app`  ← **permanent & unchangeable on Play. Confirm before building.** |
| Launcher name    | `FloodedArea` |
| Display mode     | `standalone` |
| Theme color      | `#0ea5e9` |
| Background color  | `#f4f7f9` |
| Signing key      | create a **new** keystore — record alias + store path; keep passwords OUT of the repo |

Then in the generated `twa-manifest.json`:

- Set `targetSdkVersion` to **36** (Android 16 — required for new Play submissions from
  31 Aug 2026).
- Confirm `minSdkVersion` ≥ 23.
- Run `bubblewrap update` so the Gradle project picks up the change.

### Phase 3 — Build

```bash
bubblewrap build                       # → signed .aab + keystore
keytool -list -v -keystore <keystore> -alias <alias>   # read the SHA-256 fingerprint
```

Record the SHA-256 fingerprint in the output README (below). **Do not** print or commit
keystore passwords.

### Phase 4 — Digital Asset Links

Generate `assetlinks.json` (template provided in the output dir) with:

- `package_name`: `com.floodedarea.app`
- `sha256_cert_fingerprints`: the fingerprint from Phase 3.

> **If you enable Play App Signing (recommended):** the *upload* key fingerprint differs from
> the *app-signing* key fingerprint. The **live** `assetlinks.json` must contain the
> **app-signing** key fingerprint shown in **Play Console → App integrity**. Document both and
> swap to the app-signing one post-upload.

Serve it at `https://floodedarea.com/.well-known/assetlinks.json` with
`Content-Type: application/json` (Caddy snippet provided in the output dir).

### Phase 5 — Output + document

All deliverables go to (Phase 6 of the spec):

```
/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOODEDAREA/
```

Copy in the `.aab`, `assetlinks.json`, Caddy snippet, and keystore, and finalize the README
there with the exact fingerprint(s) used.

---

## Out of scope — manual steps for Ardz (do NOT automate)

- **Do not upload to Play Console.** The `.aab` upload, store listing, data-safety form, content
  rating, and release submission are done manually by the account owner.
- **Do not enter/store any Play Console / Google credentials or keystore passwords** in
  plaintext or git.
- **Closed-testing gate:** this is a personal Play Console account, so production requires a
  **closed test with 12 testers opted in for 14 continuous days** before production access
  unlocks. Packaging does not satisfy this.
- **Back up the keystore offline.** It is irreplaceable — losing it means the app can never be
  updated.
