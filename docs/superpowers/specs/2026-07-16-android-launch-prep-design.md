# Android / Google Play Launch Prep — Design Spec

**Date:** 2026-07-16
**Scope:** Google Play (Android) launch only. iOS/App Store explicitly deferred. Two phases: (A) code/config work executed in-repo, (B) guided launch operations requiring the user's accounts.

## Goals

Ship TruckersPro to the Google Play Store as a free app: clean codebase, production app configuration, real branding assets, EAS cloud build pipeline, privacy policy URL, and a tracked launch checklist through Google's closed-testing requirement.

## Decisions (locked)

- Store name: **TruckersPro**. Android package: **`com.fatihatak.truckerspro`** (permanent once published).
- Build pipeline: **EAS Build cloud** (user has an Expo account). EAS-managed keystore and `versionCode` auto-increment. Local Gradle rejected (no Android SDK on machine; keystore risk).
- Privacy policy: **GitHub Pages** from the public `fatihatak1907/TruckersPro` repo — served from the `docs/` folder on master (Pages "deploy from branch" → `/docs`). URL: `https://fatihatak1907.github.io/TruckersPro/privacy.html`.
- Test debt: **fully cleaned** — the 3 stale `calculations.test.ts` failures and all test-file tsc errors get fixed; the "documented pre-existing failures" caveat is removed from CLAUDE.md.
- Google Play developer account ($25): user does not have one yet — creating it is step 1 of Phase B.

## Phase A — code and config (implemented via plan tasks)

### A1. Test debt cleanup

- `__tests__/calculations.test.ts`: rewrite stale fixtures to current types — fuel is `FuelEntry[]` passed as `calcOwnerOpSummary`'s third argument (not `diesel`/`def` fields on `LoadEntry`); `WeeklyExpenses` literals get all `*Frequency` fields + `other`/`otherFrequency`/`startOdometer`/`endOdometer`. Assertions updated to the current math (fuel included in totalExpenses, mileage deduction at $0.14/mi).
- `__tests__/storage.test.ts`: same fixture-shape fixes.
- `__tests__/syncEngine.test.ts`: fix the `Tuple type '[]'` error (type the mock-queue array properly).
- `CLAUDE.md`: delete the "Pre-existing failures" paragraph; replace with "Suite must be fully green."
- Exit: `npm test` all green; `npx tsc --noEmit` zero errors.

### A2. Branding assets from Logo.jpeg

Generated at build-prep time (one-off script with `npx --yes sharp-cli` or equivalent; no dependency added to package.json), overwriting the Expo placeholders in `assets/`:

- `assets/icon.png` — 1024×1024, logo centered on dark `#16171b` background.
- `assets/android-icon-foreground.png` — 1024×1024 logo with transparent padding (safe zone ~66%).
- `assets/android-icon-background.png` — solid `#16171b`.
- `assets/android-icon-monochrome.png` — white silhouette/luminance version.
- `assets/splash-icon.png` — logo ~512px wide on transparent background.

Visual check of each output is part of the task (Read the PNGs; a broken/cropped logo is a task failure).

### A3. Production app.json + eas.json

`app.json` (expo block) changes:
- `name: "TruckersPro"`, keep `slug` as-is (EAS project identity).
- `version: "1.0.0"`.
- `userInterfaceStyle: "dark"`.
- `android.package: "com.fatihatak.truckerspro"`.
- `android.adaptiveIcon.backgroundColor: "#16171b"` (replacing `#E6F4FE`).
- Splash: `expo-splash-screen` plugin config — image `./assets/splash-icon.png`, `backgroundColor: "#16171b"`, `resizeMode: "contain"`.
- `android.versionCode` NOT set manually — EAS remote version management.

New `eas.json`:
- `cli.appVersionSource: "remote"`.
- `build.production`: `autoIncrement: true`, Android app-bundle (default), env `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` via EAS environment variables (set in Phase B with `eas env:create` — NOT hardcoded into eas.json).
- `build.preview`: `distribution: "internal"`, android `buildType: "apk"` (installable test build).
- `submit.production`: placeholder for later `eas submit` use.

### A4. Privacy policy + support page

- `docs/privacy.html` — self-contained dark-styled HTML. Content: what's collected (email for auth; user-entered business data: loads, fuel, expenses, odometer), where stored (Supabase, US region), what's NOT done (no ads, no sale of data, no third-party analytics), retention/deletion (email fatihatak1907@gmail.com to delete account+data), effective date.
- `docs/index.html` — one-page app landing (name, logo, one-liner, link to privacy, contact email) — Play listing also wants a support URL.
- `docs/.nojekyll` (verbatim static serving).
- Note: `docs/` already contains `superpowers/` markdown — harmless; Pages serves it but nothing links to it.
- Enabling Pages (Settings → Pages → master `/docs`) happens in Phase B via `gh api` (no dashboard clicking needed).

### A5. Store listing content pack

`docs/superpowers/specs/` is for specs; the listing pack goes to `store/listing.md` in the repo:
- App title (30 chars), short description (80 chars), full description (up to 4000 chars) — written for owner-operators/lease/company drivers.
- Data-safety form answers (exact toggles: collects email — yes, required, account management; financial info — user-provided app functionality data, not shared; encrypted in transit — yes; deletion mechanism — email).
- Content-rating questionnaire answers (utility app, no objectionable content → Everyone).
- Screenshot shot-list (Dashboard with insights sheet open, Add Load, Fuel, Expenses with named others, History) — user takes these on their phone; minimum 2, recommended 4-8, phone 16:9 or 9:16.
- Feature graphic spec (1024×500) — generated from logo + tagline in A2's script.

### A6. Pre-launch review gates

- Security review over the full app (auth flow, RLS reliance, secrets: only `EXPO_PUBLIC_*` values may appear in the JS bundle; `.env` and `SUPABASE_ACCESS_TOKEN` must not).
- Final whole-repo code review (launch-readiness lens: crashes, empty states, offline behavior).
- Both green before Phase B builds.

## Phase B — guided launch operations (checklist doc, user + Claude together)

Tracked in `store/launch-checklist.md` (checkbox list, updated as we go):

1. `eas login` (user's Expo account) + `eas init` to link the project; `eas env:create` for the two Supabase env vars (production environment).
2. Enable GitHub Pages via `gh api` → verify privacy URL responds 200.
3. `eas build --platform android --profile preview` → user installs the APK on their phone → smoke test (login, add load, expenses, insights).
4. User creates Google Play developer account ($25, identity verification may take ~1 day).
5. `eas build --platform android --profile production` → `.aab`.
6. Play Console: create app → store listing (paste from `store/listing.md`) → upload screenshots → data safety + content rating (answers from listing pack) → upload `.aab` to **closed testing**.
7. Closed testing: 12 testers, 14 continuous days (Google's requirement for new personal accounts). Recruit via link; I draft the invite message.
8. After 14 days: apply for production access → promote to production → live.

Costs: $25 one-time (Play). EAS free tier suffices. Supabase Pro ($25/mo) recommended at launch to stop free-tier pausing — decision deferred to step 7 time.

## Error handling / risks

- EAS build failures on first run (dependency mismatches: expo/netinfo version warnings) — the plan includes running `npx expo install --check` and aligning the two flagged packages BEFORE the first build, since Expo itself warns "may not work correctly".
- Keystore: EAS-managed; nothing stored locally.
- Privacy URL must be live before the data-safety form references it (Phase B step 2 precedes step 6).

## Testing

- A1 exit gates (green suite, clean tsc) are the regression net for everything else.
- A2/A3: `npx expo config --type prebuild` parses cleanly; icons visually verified.
- Phase B step 3 (preview APK on the user's phone) is the end-to-end gate before the production build.
