# FloodedArea — Google Play packaging (TWA) runbook

Goal: publish FloodedArea to Google Play **without forking the codebase** by wrapping the live
site `https://floodedarea.com/` in a **Trusted Web Activity (TWA)** built with **Bubblewrap**.
The website stays the single source of truth; content updates ship via the web with no Play
review in the loop.

Spec of record: `../baha-api/PLAYSTORE_PACKAGE_REQUIREMENTS.md`.

---

## Status & outstanding TODOs

**Last verified: 2026-08-08** — against `060-feat-playstore-assetlinks` @ v1.54.0 and the live site.

**Phase 1 (PWA readiness) — DONE & deployed.** All of it is on `main` (not just the stale
`playstore-package` branch, which points at v1.26.0 and can be ignored). The manifest resolves
live at `https://floodedarea.com/manifest.webmanifest` (HTTP 200, valid PWA JSON), so the
Phase-2 ordering dependency below is **already satisfied** — Bubblewrap can read it now.

Remaining work, in order:

- [x] **Fix the manifest `Content-Type`** — done on branch `060`. `nginx/default.conf.template`
      now has a `location = /manifest.webmanifest` block using **`default_type
      application/manifest+json`**. Note this deviates from the snippet previously recorded
      below: `add_header Content-Type` does *not* work, because nginx always emits its own
      `Content-Type` and `add_header` appends a duplicate instead of replacing it. Since
      `.webmanifest` is simply absent from `mime.types`, `default_type` is the correct lever.
      **Still needs a redeploy to take effect.**
- [x] **Phase 2 — TWA init.** Done. Project generated at `../baha-twa/` with Application ID
      `com.floodedarea.app`, `launcherName` `FloodedArea`, `targetSdkVersion 36`,
      `minSdkVersion 23` (the library default is 21 — explicitly overridden), `orientation`
      portrait. Generated non-interactively via Bubblewrap's own `TwaManifest`/`TwaGenerator`
      library, since `bubblewrap init`'s prompts need a TTY.
- [x] **Keystore created.** `../baha-twa/android.keystore`, alias `android`, RSA 2048,
      10000-day validity. ⚠️ **Not backed up yet — do this.** Irreplaceable.
- [ ] **Phase 3 — build.** `bubblewrap build` in `../baha-twa/` → signed `.aab`. Reads
      `BUBBLEWRAP_KEYSTORE_PASSWORD` / `BUBBLEWRAP_KEY_PASSWORD` from the environment, else
      prompts (prefer prompting — keeps passwords out of shell history).
- [x] **Phase 4 — Digital Asset Links (upload key).** `public/.well-known/assetlinks.json`
      committed on branch `060` with the **upload-key** fingerprint
      `FD:5F:…:41:1E`, generated via Bubblewrap's `DigitalAssetLinks.generateAssetLinks()`.
      Verified it survives into `dist/.well-known/` (Vite does copy dot-directories out of
      `public/`). **Still 404 live — needs the redeploy.**
- [ ] **Phase 4b — add the app-signing fingerprint.** After the first Play upload, copy the
      **app-signing** SHA-256 from Play Console → App integrity and add it as a *second* entry
      in the `sha256_cert_fingerprints` array (it is a list — keep both, so verification holds
      before and after Play re-signs). Redeploy.
- [ ] **Phase 5 — output.** Copy deliverables to the OUTPUT dir and finalize that README.
- [ ] **Play Console prerequisites** (account owner, manual): privacy-policy URL (app collects
      geolocation + account email + crowd-sourced reports), store listing + screenshots +
      feature graphic, content rating, data-safety form, and the **closed test: 12 testers ×
      14 continuous days** before production unlocks. Start the closed test early — longest pole.

### nginx — serve the manifest with the right Content-Type

Production is served by **nginx** (`Dockerfile` + `nginx/default.conf.template`), not Caddy.
Add this inside the `server { }` block:

```nginx
location = /manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "public, max-age=3600";
}
```

> ⚠️ An earlier revision of this runbook used `add_header Content-Type "application/manifest+json"`.
> That does **not** work: nginx always emits its own `Content-Type`, so `add_header` appends a
> second one rather than replacing it. `.webmanifest` is missing from nginx's `mime.types`, so
> the type falls through to the global `default_type` — overriding `default_type` in this one
> location is the correct fix. This is already applied in `nginx/default.conf.template`.

Re-verify after redeploy:

```bash
curl -sI https://floodedarea.com/manifest.webmanifest | grep -i content-type
# expect: content-type: application/manifest+json
```

> The `.well-known/assetlinks.json` route needs **no** nginx change: the template has no
> dotfile-deny block and `.json` already maps to `application/json`, so dropping the file into
> `public/.well-known/` ships it to `dist/` and serves it correctly.

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

**Bubblewrap reads the manifest from the production URL**, so the site must serve a live
manifest **before** running `bubblewrap init`.

**Status (2026-06-30): satisfied.** `https://floodedarea.com/manifest.webmanifest` resolves
(HTTP 200, valid PWA JSON). The only caveat is the `Content-Type` — see the first TODO above.

```bash
curl -sI https://floodedarea.com/manifest.webmanifest
# 200 — but currently content-type: application/octet-stream (should be application/manifest+json)
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
`Content-Type: application/json`. On this stack that just means committing the file to
`public/.well-known/assetlinks.json` (Vite copies it into `dist/`, and nginx serves `.json` as
`application/json` with no config change). Verify: `curl -sI .../.well-known/assetlinks.json`.

### Phase 5 — Output + document

All deliverables go to (Phase 6 of the spec):

```
/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOODEDAREA/
```

Copy in the `.aab`, `assetlinks.json`, the nginx snippet, and keystore, and finalize the README
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
