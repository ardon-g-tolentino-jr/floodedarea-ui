# FloodedArea — Play Store: what's left

**Snapshot: 2026-08-09.** Companion to [`PLAYSTORE_PACKAGE.md`](./PLAYSTORE_PACKAGE.md) (the full
runbook). That file explains *how*; this file is only *what remains*, in the order it should be
done. Owner is marked **[you]** (needs a password, a Google account, or server access) or
**[claude]** (can be automated).

> **Steps 1 and 2 are done** — the `.aab` is signed and the privacy policy is live. The next
> action is **step 3 (Play Console)**, then **step 4 (closed test)** the same day you upload.
> Read step 5 before uploading: it is a submission risk that has no work started on it.

---

## Critical path

The long pole is the **closed test: 12 testers opted in for 14 continuous days**, and it can't
start until a signed build is uploaded. Everything in this section is therefore ordered to reach
that upload as fast as possible.

### 1. ~~Sign the `.aab`~~ — ✅ done 2026-08-08

`../baha-twa/app-release-bundle.aab` (1.6 MB) is signed and ready to upload. Verified: the
certificate embedded in the bundle has a SHA-256 matching the fingerprint already published in
`assetlinks.json`, so Digital Asset Links verification will hold for this build.

```
Owner:   CN=Ardon Tolentino, OU=NA, O=NA, L=NA, ST=NA, C=PH
SHA-256: FD:5F:…:C4:41:1E    ← matches live assetlinks.json
```

### 2. ~~Publish a privacy policy~~ — ✅ done 2026-08-09

Live at **`https://floodedarea.com/privacy.html`** — use exactly this URL in Play Console. Source
is `public/privacy.html`: a self-contained static file with no fonts, scripts, or external
requests, so it resolves without relying on the SPA `try_files` fallback that production does not
run.

Its disclosures were derived from the source rather than boilerplate, because **Play cross-checks
the policy against the Data safety form**. Fill that form to match: precise location (including
continuous tracking via `watchPosition`), account email/name/picture, report payload with stored
photo, SOS coordinates plus free-text note, a persistent guest device UUID, and nine third parties
(OSM tiles, Nominatim, Overpass, Google Sign-In, Cloudflare Turnstile, Statcounter, Google Fonts,
tlk.io, share targets).

Two follow-ups:

- [ ] **Confirm four claims made on your behalf** — [you]. Inferred from code, not verified:
      (a) "we do not sell your data / no advertising"; (b) that a deletion-on-request process
      genuinely exists; (c) the SOS retention wording ("while handled and a reasonable period
      after"); (d) "non-commercial", given `public/gcash-qr.png` implies you accept donations.
- [ ] **Link the policy from inside the app** — [claude]. It is currently reachable only by
      direct URL. Reviewers and users expect an in-app link (sidebar or TopBar menu).

### 3. Play Console — create, upload, configure — **[you]**

All manual, account-owner only. Do not automate; do not store Console credentials anywhere.

- [ ] Create the app. **Application ID `com.floodedarea.app` is permanent and unchangeable** —
      confirm it at creation.
- [ ] Store listing:
      - Title (max 30 chars): **`FloodedArea: PH Flood Watch`** (27) — "FloodedArea" alone is a
        coined word with no organic search volume; the suffix carries the ASO terms.
      - Short description (80), full description (4000).
      - Screenshots (min 2, phone), 512×512 icon, 1024×500 feature graphic.
- [ ] **Privacy policy URL:** `https://floodedarea.com/privacy.html` (see step 2).
- [ ] Data safety form — must match the disclosures in step 2.
- [ ] Content rating questionnaire.
- [ ] Target audience / ads declaration.
- [ ] **Enable Play App Signing** (recommended; assumed by step 6).
- [ ] Upload the signed `.aab` from `../baha-twa/app-release-bundle.aab`.

### 4. Start the closed test immediately after upload — **[you]**

Personal Play Console accounts require **12 testers opted in for 14 continuous days** before
production access unlocks. The clock only starts once testers actually opt in. Nothing else on
this list gates it, so start it the same day you upload — it is the single longest item here.

### 5. User-generated content compliance — **[you]** ⚠️ nothing started

**This is the biggest un-started risk on the list, and it can fail review on its own** —
independently of the privacy policy, which does not satisfy it.

FloodedArea carries three streams of user-generated content:

1. **Flood reports** — free-text display name, location.
2. **Photos** — user-uploaded images, stored in the database.
3. **Community chat** — a public, anonymous [tlk.io](https://tlk.io) room embedded via iframe in
   `src/components/panels/ChatWidget.tsx`. It is unmoderated and not under your control.

Play's UGC policy expects, at minimum:

- [ ] A published **content policy / community standards** users agree to.
- [ ] An **in-app mechanism to report or flag** objectionable content and users.
- [ ] A way to **block abusive users**.
- [ ] A **moderation process** you can describe to reviewers, with removal turnaround.
- [ ] Content rating answers that honestly reflect unmoderated public chat — this alone can push
      the rating to a higher age band.

The anonymous third-party chat is the weakest point: you cannot moderate it, cannot delete from
it, and cannot block users in it. **Seriously consider removing `ChatWidget` before submitting**,
or replacing it with a first-party channel you can moderate. Shipping an unmoderated anonymous
chat room is a common and avoidable rejection.

> Note: `ChatWidget.tsx` refers readers to "PLAYSTORE_PACKAGE.md for the Play-store UGC
> follow-ups" — **that section has never existed**. This item is that gap.

---

## After the first upload

### 6. Add the app-signing fingerprint to `assetlinks.json` — **[claude]** (needs a value from you)

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

### 7. Manifest `Content-Type` — **[you]** (needs server access)

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

### 8. Deliverables + docs housekeeping — **[claude]**

- [ ] Copy the **signed** `.aab` to `/Users/ardontolentinojr./Documents/CLAUDE DEV/OUTPUT/DB/FLOODEDAREA/`
      and finalize the README there (Phase 5 of the runbook).
- [ ] Add the `060-feat-playstore-assetlinks` entry to `baha-api/documentations/CHANGELOG.md` —
      required by the dev process, still outstanding. A `061` entry will be needed for this file too.
- [ ] Correct `PLAYSTORE_PACKAGE.md`: it states production is served by the Docker image +
      `nginx/default.conf.template`. That is wrong (see below) and will mislead the next person.
- [ ] Delete the stale `Caddyfile.snippet` from the OUTPUT dir, or keep it marked unused.

### 9. `versionCode` discipline — **[you]**, ongoing

The build is `versionCode 1` / `versionName "1"`. **Every** subsequent Play upload needs a strictly
higher `versionCode`. Bump it in `../baha-twa/twa-manifest.json` and re-run `bubblewrap build`.
Note this is independent of the web app's `package.json` version (currently 1.55.0) — they are
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
- **Signed** `.aab` at `../baha-twa/app-release-bundle.aab` — package `com.floodedarea.app`,
  `versionCode 1`, `targetSdkVersion 36`, verified via `aapt2 dump badging`, and its signing
  certificate confirmed to match the published assetlinks fingerprint.
- **Privacy policy** live at `https://floodedarea.com/privacy.html` (`public/privacy.html`,
  shipped in v1.55.0) — self-contained, no external requests.
