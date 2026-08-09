# FloodedArea — Play Store: what's left

**Snapshot: 2026-08-09.** Companion to [`PLAYSTORE_PACKAGE.md`](./PLAYSTORE_PACKAGE.md) (the full
runbook). That file explains *how*; this file is only *what remains*, in the order it should be
done. Owner is marked **[you]** (needs a password, a Google account, or server access) or
**[claude]** (can be automated).

---

## Critical path

The long pole is the **closed test: 12 testers opted in for 14 continuous days**, and it can't
start until a signed build is uploaded. Everything in this section is therefore ordered to reach
that upload as fast as possible.

### 1. Sign the `.aab` — **[you]**

The bundle is built but **unsigned**. Signing needs the keystore password, which is deliberately
not stored anywhere in this repo or in the deliverables dir.

```bash
cd "../baha-twa"
bubblewrap build          # prompts for keystore password, then key password
```

Prefer the interactive prompt over `BUBBLEWRAP_KEYSTORE_PASSWORD=... bubblewrap build` — the
inline form lands in shell history. Gradle is already warm, so this is quick, and the
`manifest-checksum.txt` is in place so it won't ask to regenerate the project.

Current unsigned artifacts in `../baha-twa/`:

```
app/build/outputs/bundle/release/app-release.aab    1.6M   ← upload artifact
app-release-unsigned-aligned.apk                    1.4M   ← sideload/testing only
```

### 2. Publish a privacy policy — **[you]** ⚠️ hard blocker

**None exists.** `/privacy`, `/privacy.html`, `/privacy-policy` and `/terms` all return 404 on
floodedarea.com, and the app bundle contains no privacy-policy link.

Play requires a publicly reachable privacy-policy URL *before* the data-safety form can be
submitted, and this app is squarely in the categories that force it:

| Data collected | Where |
|---|---|
| Precise location (geolocation) | flood reports, distance/ETA, SOS |
| Account email + name | Basic login and Google SSO |
| User-generated content | crowd-sourced reports, photos |
| Emergency contact data | SOS rescue requests |

Simplest route: add a static `public/privacy.html` to this repo so it deploys with `dist/`, then
point Play Console at `https://floodedarea.com/privacy.html`. **Caveat:** production does not
appear to run this repo's nginx SPA-fallback config (see *Known issues* below), so verify the URL
actually resolves after deploying rather than assuming it does.

### 3. Play Console — create, upload, configure — **[you]**

All manual, account-owner only. Do not automate; do not store Console credentials anywhere.

- [ ] Create the app. **Application ID `com.floodedarea.app` is permanent and unchangeable** —
      confirm it at creation.
- [ ] Store listing:
      - Title (max 30 chars): **`FloodedArea: PH Flood Watch`** (27) — "FloodedArea" alone is a
        coined word with no organic search volume; the suffix carries the ASO terms.
      - Short description (80), full description (4000).
      - Screenshots (min 2, phone), 512×512 icon, 1024×500 feature graphic.
- [ ] Data safety form — must match the table in item 2.
- [ ] Content rating questionnaire.
- [ ] Target audience / ads declaration.
- [ ] **Enable Play App Signing** (recommended; assumed by item 4).
- [ ] Upload the signed `.aab`.

### 4. Start the closed test immediately after upload — **[you]**

Personal Play Console accounts require **12 testers opted in for 14 continuous days** before
production access unlocks. The clock only starts once testers actually opt in. Nothing else on
this list gates it, so start it the same day you upload — it is the single longest item here.

---

## After the first upload

### 5. Add the app-signing fingerprint to `assetlinks.json` — **[claude]** (needs a value from you)

With Play App Signing on, Google re-signs the bundle with a **different** key than the upload key.
The live `assetlinks.json` currently carries only the upload key, so verification will break for
store-installed users until the app-signing fingerprint is added.

- [ ] Copy the SHA-256 from **Play Console → Test and release → App integrity → App signing key
      certificate**.
- [ ] **Add** it as a second entry in `public/.well-known/assetlinks.json` →
      `sha256_cert_fingerprints`. It is an **array** — keep both, so verification holds for
      sideloaded (upload-key) and store (app-signing-key) installs alike. Do not replace.
- [ ] Rebuild `dist/`, commit, push to `main` (auto-deploys).
- [ ] Re-verify with Google's verifier (expect 2 statements, `errors: []`):

```bash
curl -s "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://floodedarea.com&relation=delegate_permission/common.handle_all_urls"
```

Symptom if this is skipped or wrong: the installed app opens with a **browser URL bar** across the
top instead of running full-screen. It fails silently — the file still returns 200.

---

## Not blocking Play, but open

### 6. Manifest `Content-Type` — **[you]** (needs server access)

`https://floodedarea.com/manifest.webmanifest` still serves as `application/octet-stream`.
Bubblewrap tolerated this (the build succeeded), so it does **not** block Play. It does fail
strict PWA installability and Lighthouse.

The fix committed in branch `060` to `nginx/default.conf.template` is **inert** — production does
not use that config (see *Known issues*). It has to be applied to the config of the nginx that
actually serves floodedarea.com, then reloaded:

```nginx
location = /manifest.webmanifest {
    default_type application/manifest+json;
    add_header Cache-Control "public, max-age=3600";
}
```

Use `default_type`, **not** `add_header Content-Type` — nginx always emits its own `Content-Type`,
so `add_header` appends a duplicate rather than replacing it. `.webmanifest` is simply absent from
nginx's bundled `mime.types`, which is why the type falls through to the global default.

Verify: `curl -sI https://floodedarea.com/manifest.webmanifest | grep -i content-type`

### 7. Deliverables + docs housekeeping — **[claude]**

- [ ] Copy the **signed** `.aab` to `/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOODEDAREA/`
      and finalize the README there (Phase 5 of the runbook).
- [ ] Add the `060-feat-playstore-assetlinks` entry to `baha-api/documentations/CHANGELOG.md` —
      required by the dev process, still outstanding. A `061` entry will be needed for this file too.
- [ ] Correct `PLAYSTORE_PACKAGE.md`: it states production is served by the Docker image +
      `nginx/default.conf.template`. That is wrong (see below) and will mislead the next person.
- [ ] Delete the stale `Caddyfile.snippet` from the OUTPUT dir, or keep it marked unused.

### 8. `versionCode` discipline — **[you]**, ongoing

The build is `versionCode 1` / `versionName "1"`. **Every** subsequent Play upload needs a strictly
higher `versionCode`. Bump it in `../baha-twa/twa-manifest.json` and re-run `bubblewrap build`.
Note this is independent of the web app's `package.json` version (currently 1.54.0) — they are
different numbering schemes and do not need to track each other.

---

## Known issues / things to verify

**Production does not run this repo's nginx config.** Discovered 2026-08-08 while verifying the
deploy. Evidence:

- `/assets/*.js` returns no `Cache-Control: public, immutable` and no `expires`, though the repo
  config sets both.
- No `Cross-Origin-Opener-Policy` header, though the repo config sets it `always`.
- `/privacy` returns **404** rather than the SPA `try_files` fallback to `index.html`.
- Live reports `server: nginx/1.24.0`; the Dockerfile builds on `nginx:alpine`, which would be
  substantially newer.

The deploy pipeline evidently syncs `dist/` to disk (new files *do* go live — `assetlinks.json`
appeared and the bundle hash updated) but does not apply this repo's nginx config. Consequences:

- [ ] **Verify the `/__prerender` social-crawler OG rule is actually live.** It is defined in the
      same config block that appears inactive. A test with an empty `?report=` was **inconclusive**
      (nginx serves static when `$arg_report` is empty), so this is unconfirmed, not known-broken.
      Retest with a real report id and a crawler User-Agent:
      ```bash
      curl -s -A "facebookexternalhit/1.1" "https://floodedarea.com/?report=<real-id>" \
        | grep -o '<meta property="og:title"[^>]*'
      ```
      If it returns the generic site-wide title instead of per-report text, the per-report share
      previews shipped in branches 057/059 are not working in production.
- [ ] Decide where the canonical production nginx config lives, and either point the deploy at the
      repo's template or document the real location so the two stop drifting.

---

## Done (for context)

- PWA readiness — manifest, service worker, icons. On `main`.
- Toolchain — JDK 17, Android SDK (platform 36, build-tools 36.1.0), Bubblewrap CLI.
  `~/.bubblewrap/config.json` points `jdkPath` at the `.jdk` **bundle root** (macOS Bubblewrap
  appends `/Contents/Home/` itself); the SDK needed a `tools` → `cmdline-tools/latest` symlink.
  `bubblewrap doctor` passes.
- TWA project at `../baha-twa/` — appId `com.floodedarea.app`, launcher name `FloodedArea`,
  `targetSdkVersion 36`, `minSdkVersion 23`, portrait.
- Keystore `../baha-twa/android.keystore` (alias `android`, RSA 2048, 10000 days) — created and
  **backed up offline**.
- Upload-key SHA-256:
  `FD:5F:31:41:D3:FB:99:63:03:72:60:DA:0F:A4:51:1C:D8:E0:B2:A6:54:F4:8D:8E:8D:C6:8F:5B:73:C4:41:1E`
- `assetlinks.json` live at `https://floodedarea.com/.well-known/assetlinks.json` (200,
  `application/json`) and confirmed by Google's Digital Asset Links API — 1 statement, `errors: []`,
  correct package and fingerprint.
- Unsigned `.aab` + `.apk` built and verified via `aapt2 dump badging`.
