# Android Launch Prep Implementation Plan (Phase A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the repo Google-Play-ready: fully green tests, real branding assets from Logo.jpeg, production `app.json` + `eas.json`, privacy/landing pages for GitHub Pages, and the store listing pack — gated by security + final reviews.

**Architecture:** Pure repo work (no runtime feature changes). Asset generation is a one-off Node script using `sharp` installed with `--no-save` (nothing added to package.json). Phase B (builds, Play Console) is a separate guided checklist, not in this plan's tasks.

**Tech Stack:** Expo SDK 54, EAS Build, Jest, sharp (one-off), GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-07-16-android-launch-prep-design.md`

## Global Constraints

- Android package: `com.fatihatak.truckerspro`. Store name: `TruckersPro`. Version `1.0.0`; `versionCode` managed remotely by EAS (never set in app.json).
- No new runtime npm dependencies except `expo-splash-screen` if missing (install via `npx expo install expo-splash-screen`). `sharp` only via `npm install sharp --no-save --legacy-peer-deps`.
- **Spec deviation (approved rationale):** spec A2/A3 said dark `#16171b` splash/adaptive backgrounds, but `Logo.jpeg` has a baked-in LIGHT background (~`#ECECEA`) — splash and adaptive-icon backgrounds must match the logo's own background so it doesn't float in a mismatched box. The in-app UI stays dark. Sample the actual corner color in the asset script and use that value everywhere.
- Exit gates for the whole plan: `npm test` 100% green (no "documented failures" exception anymore), `npx tsc --noEmit` zero errors, `npx expo config --type prebuild` parses cleanly.
- Contact email in all documents: `fatihatak1907@gmail.com`. Privacy URL: `https://fatihatak1907.github.io/TruckersPro/privacy.html`.

---

### Task 1: Test debt cleanup (green suite, clean tsc)

**Files:**
- Modify: `__tests__/calculations.test.ts` (owner-op describe, lines 10-66)
- Modify: `__tests__/storage.test.ts:20-31` (sampleLoad), `__tests__/storage.test.ts:56-63` (expenses fixture)
- Modify: `__tests__/syncEngine.test.ts` (every `jest.fn(() => Promise.resolve(...))` upsert/delete mock whose `.mock.calls[0][0]` is read)
- Modify: `CLAUDE.md` (Tests section)

**Interfaces:**
- Consumes: `calcOwnerOpSummary(loads, expenses, fuelEntries)` — fuel via `FuelEntry[]` third arg; `WeeklyExpenses` requires all 7 `*Frequency` fields + `other`/`otherFrequency`/odometers.

- [ ] **Step 1: Rewrite the stale owner-op describe** in `__tests__/calculations.test.ts` — replace lines 10-66 with:

```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../src/types';
// (replace the existing type-only import line)

describe('calcOwnerOpSummary', () => {
  const loads: LoadEntry[] = [
    {
      id: '1', weekKey, driverType: 'owner-op',
      startLocation: 'TX', endLocation: 'CA',
      createdAt: '2026-05-25',
      earnings: 3000, commissionRate: 0.10,
    },
    {
      id: '2', weekKey, driverType: 'owner-op',
      startLocation: 'CA', endLocation: 'AZ',
      createdAt: '2026-05-26',
      earnings: 1500, commissionRate: 0.12,
    },
  ];
  const fuel: FuelEntry[] = [
    { id: 'f1', weekKey, type: 'diesel', cost: 400, createdAt: '2026-05-25T10:00:00Z' },
    { id: 'f2', weekKey, type: 'def',    cost: 30,  createdAt: '2026-05-25T10:05:00Z' },
    { id: 'f3', weekKey, type: 'diesel', cost: 200, createdAt: '2026-05-26T10:00:00Z' },
    { id: 'f4', weekKey, type: 'def',    cost: 15,  createdAt: '2026-05-26T10:05:00Z' },
  ];
  const expenses: WeeklyExpenses = {
    weekKey,
    truckPayment: 600, truckPaymentFrequency: 'weekly',
    truckInsurance: 250, truckInsuranceFrequency: 'weekly',
    trailerInsurance: 80, trailerInsuranceFrequency: 'weekly',
    trailerLease: 200, trailerLeaseFrequency: 'weekly',
    iftaCost: 50, iftaCostFrequency: 'weekly',
    adminFee: 40, adminFeeFrequency: 'weekly',
    other: 0, otherFrequency: 'weekly',
    startOdometer: 100000, endOdometer: 103500,
  };

  it('calculates totalEarnings', () => {
    const result = calcOwnerOpSummary(loads, expenses, fuel);
    expect(result.totalEarnings).toBe(4500); // 3000 + 1500
  });

  it('calculates totalExpenses = fixed + commission + fuel', () => {
    const result = calcOwnerOpSummary(loads, expenses, fuel);
    // fixed = 600+250+80+200+50+40 = 1220
    // commission = 3000*0.10 + 1500*0.12 = 480
    // fuel = 400+30+200+15 = 645
    expect(result.totalExpenses).toBe(2345);
    expect(result.totalDiesel).toBe(600);
    expect(result.totalDef).toBe(45);
  });

  it('calculates mileage deduction', () => {
    const result = calcOwnerOpSummary(loads, expenses, fuel);
    expect(result.milesDriven).toBe(3500);
    expect(result.mileageDeduction).toBeCloseTo(490, 1); // 3500 * 0.14
  });

  it('calculates net profit', () => {
    const result = calcOwnerOpSummary(loads, expenses, fuel);
    // 4500 - 2345 - 490 = 1665
    expect(result.netProfit).toBeCloseTo(1665, 0);
  });

  it('handles monthly truck payment by dividing by 4.33', () => {
    const monthlyExpenses = { ...expenses, truckPaymentFrequency: 'monthly' as const };
    const result = calcOwnerOpSummary(loads, monthlyExpenses, fuel);
    const fixedExpenses = 600 / 4.33 + 250 + 80 + 200 + 50 + 40;
    expect(result.totalExpenses).toBeCloseTo(fixedExpenses + 480 + 645, 1);
  });
});
```

(The two company-mode describes are already correct — leave them.)

- [ ] **Step 2: Fix `__tests__/storage.test.ts` fixtures.** In `sampleLoad` (lines 20-31) delete the `diesel: 350,` and `def: 25,` lines. Replace the `expenses` fixture (lines 57-63) with the complete shape:

```ts
  const expenses: WeeklyExpenses = {
    weekKey: '2026-05-25',
    truckPayment: 600, truckPaymentFrequency: 'weekly',
    truckInsurance: 250, truckInsuranceFrequency: 'weekly',
    trailerInsurance: 80, trailerInsuranceFrequency: 'weekly',
    trailerLease: 200, trailerLeaseFrequency: 'weekly',
    iftaCost: 50, iftaCostFrequency: 'weekly',
    adminFee: 40, adminFeeFrequency: 'weekly',
    other: 0, otherFrequency: 'weekly',
    startOdometer: 100000, endOdometer: 103500,
  };
```

(Assertions are unchanged — `getWeeklyExpenses` now returns normalized objects with `otherExpenses: []`, which no assertion contradicts.)

- [ ] **Step 3: Fix `__tests__/syncEngine.test.ts` tuple errors.** Every mock whose `.mock.calls[0][0]` is inspected must declare an argument, e.g. change

```ts
const upsertMock = jest.fn(() => Promise.resolve({ error: null }));
```

to

```ts
const upsertMock = jest.fn((_row: any) => Promise.resolve({ error: null }));
```

Apply the same `(_row: any)` (or `(..._args: any[])`) pattern to each mock the file reads `.mock.calls[...]` from. Do not change any assertion.

- [ ] **Step 4: Update `CLAUDE.md`.** In the `## Tests` section, delete the entire "**Pre-existing failures**" paragraph and add in its place: `The suite must be fully green — a failing test blocks merges and releases.`

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: ALL suites pass, 0 failures.
Run: `npx tsc --noEmit`
Expected: zero errors, zero output.

- [ ] **Step 6: Commit**

```bash
git add __tests__/calculations.test.ts __tests__/storage.test.ts __tests__/syncEngine.test.ts CLAUDE.md
git commit -m "test: modernize stale fixtures; suite fully green for release"
```

---

### Task 2: Branding assets from Logo.jpeg

**Files:**
- Create: `scripts/gen-assets.js` (committed — rerunnable when the logo changes)
- Overwrite: `assets/icon.png`, `assets/android-icon-foreground.png`, `assets/android-icon-background.png`, `assets/android-icon-monochrome.png`, `assets/splash-icon.png`
- Create: `store/feature-graphic.png` (1024×500)

**Interfaces:**
- Produces: the asset files above; prints the sampled background hex (Task 3 pastes it into app.json).

- [ ] **Step 1: Create `scripts/gen-assets.js`:**

```js
/* One-off branding asset generator. Run:
 *   npm install sharp --no-save --legacy-peer-deps
 *   node scripts/gen-assets.js
 */
const sharp = require('sharp');
const path = require('path');
const SRC = path.join(__dirname, '..', 'Logo.jpeg');
const A = (f) => path.join(__dirname, '..', 'assets', f);

async function main() {
  // Sample the top-left corner for the baked background color
  const { data } = await sharp(SRC).extract({ left: 8, top: 8, width: 16, height: 16 })
    .resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  const bg = { r: data[0], g: data[1], b: data[2] };
  const hex = '#' + [bg.r, bg.g, bg.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  console.log('sampled background:', hex);

  // 1024 app icon (square source, straight resize)
  await sharp(SRC).resize(1024, 1024).png().toFile(A('icon.png'));

  // Adaptive foreground: logo scaled to 66% safe zone, centered on the sampled bg
  const inner = await sharp(SRC).resize(676, 676).png().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: inner, gravity: 'center' }]).png().toFile(A('android-icon-foreground.png'));

  // Adaptive background: solid sampled color
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { ...bg, alpha: 1 } } })
    .png().toFile(A('android-icon-background.png'));

  // Monochrome: white shape on transparent — luminance-inverted alpha mask
  const mask = await sharp(SRC).resize(1024, 1024).greyscale().negate().toBuffer();
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .joinChannel(mask).png().toFile(A('android-icon-monochrome.png'));

  // Splash icon: logo at 1024, own background
  await sharp(SRC).resize(1024, 1024).png().toFile(A('splash-icon.png'));

  // Feature graphic 1024x500: logo left, wordmark right, on sampled bg
  const logoSmall = await sharp(SRC).resize(420, 420).png().toBuffer();
  const text = Buffer.from(`<svg width="1024" height="500">
    <text x="470" y="240" font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="800" fill="#1c1d22">TruckersPro</text>
    <text x="472" y="300" font-family="Arial, Helvetica, sans-serif" font-size="34" fill="#4a4d55">Know your real profit, every week</text>
  </svg>`);
  await sharp({ create: { width: 1024, height: 500, channels: 4, background: { ...bg, alpha: 1 } } })
    .composite([{ input: logoSmall, left: 30, top: 40 }, { input: text, left: 0, top: 0 }])
    .png().toFile(path.join(__dirname, '..', 'store', 'feature-graphic.png'));
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it**

```bash
mkdir -p store
npm install sharp --no-save --legacy-peer-deps
node scripts/gen-assets.js
```

Expected: prints `sampled background: #......`; six PNGs written. Record the hex for Task 3.

- [ ] **Step 3: Visually verify EVERY output** — Read each PNG (`assets/icon.png`, `android-icon-foreground.png`, `android-icon-monochrome.png`, `splash-icon.png`, `store/feature-graphic.png`) and confirm: logo centered and uncropped, no distortion, monochrome is a recognizable white silhouette on transparency, feature graphic text not overlapping the logo. A broken/cropped/garbled output is a task failure — adjust the script and rerun.

- [ ] **Step 4: Commit**

```bash
git add scripts/gen-assets.js assets/ store/feature-graphic.png
git commit -m "feat: production branding assets generated from Logo.jpeg"
```

---

### Task 3: Production app.json + eas.json + dependency alignment

**Files:**
- Modify: `app.json`
- Create: `eas.json`

**Interfaces:**
- Consumes: sampled background hex from Task 2 (referred to as `<BG_HEX>` below — substitute the actual value, e.g. `#ececea`).

- [ ] **Step 1: Align the two flagged packages** (Expo warned about them at every start):

```bash
npx expo install expo@~54.0.36 @react-native-community/netinfo@11.4.1
npx expo install expo-splash-screen
```

(All go through `expo install` so versions match the SDK. If `npm` peer errors appear, append `-- --legacy-peer-deps`.)

- [ ] **Step 2: Replace `app.json` with:**

```json
{
  "expo": {
    "name": "TruckersPro",
    "slug": "Truckerspro",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "plugins": [
      [
        "expo-splash-screen",
        {
          "image": "./assets/splash-icon.png",
          "imageWidth": 220,
          "resizeMode": "contain",
          "backgroundColor": "<BG_HEX>"
        }
      ]
    ],
    "android": {
      "package": "com.fatihatak.truckerspro",
      "adaptiveIcon": {
        "backgroundColor": "<BG_HEX>",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    }
  }
}
```

(`slug` stays `Truckerspro` — changing it would orphan any existing EAS project link. No `ios` block — iOS is deferred; add it back when needed.)

- [ ] **Step 3: Create `eas.json`:**

```json
{
  "cli": {
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true,
      "environment": "production"
    },
    "preview": {
      "distribution": "internal",
      "environment": "production",
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

(Supabase env vars are NOT in this file — they're set as EAS environment variables in Phase B step 1: `eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL ...` etc.)

- [ ] **Step 4: Verify**

Run: `npx expo config --type prebuild > /dev/null && echo OK`
Expected: `OK` (config parses; no schema errors).
Run: `npm test` → all green. Run: `npx tsc --noEmit` → clean.
Run: `npx expo start` briefly in background, confirm the two version warnings are GONE, then kill it.

- [ ] **Step 5: Commit**

```bash
git add app.json eas.json package.json package-lock.json
git commit -m "chore: production app config, EAS profiles, SDK dependency alignment"
```

---

### Task 4: Privacy policy, landing page, listing pack, launch checklist

**Files:**
- Create: `docs/privacy.html`, `docs/index.html`, `docs/.nojekyll`
- Create: `store/listing.md`, `store/launch-checklist.md`

- [ ] **Step 1: Create `docs/privacy.html`** — complete, self-contained (no external assets), dark-styled, with these exact content sections (write full prose, not bullets-of-bullets; effective date 2026-07-16; contact fatihatak1907@gmail.com):

1. **What we collect** — email address (account login via Supabase Auth); user-entered business records: loads (routes, earnings, TONU, commission), fuel purchases, weekly expenses, odometer readings, optional driver/company name.
2. **How it's used** — solely to provide the app's features (weekly profit tracking, sync across your devices). No advertising, no analytics SDKs, no sale or sharing of personal data with third parties.
3. **Where it's stored** — on your device (offline-first) and synced to Supabase (hosted cloud database); transport encrypted via HTTPS/TLS; access restricted to your account via row-level security.
4. **Data retention & deletion** — data kept while the account exists; email fatihatak1907@gmail.com from your account email to have the account and all data permanently deleted.
5. **Children** — not directed at children under 13.
6. **Changes** — updates posted at this URL.

- [ ] **Step 2: Create `docs/index.html`** — one-page landing: TruckersPro name + tagline ("Know your real profit, every week"), 3-line feature summary (weekly net-profit dashboard with tap-in insights; loads, fuel, and confirmed expenses; works offline, syncs when connected), link to `privacy.html`, contact mailto. Same self-contained dark styling. Create empty `docs/.nojekyll`.

- [ ] **Step 3: Create `store/listing.md`** with exactly these sections:

```markdown
# Google Play Listing — TruckersPro

## Title (≤30 chars)
TruckersPro – Trucker Profit

## Short description (≤80 chars)
Weekly profit tracker for owner-operators, lease & company truck drivers.

## Full description (≤4000 chars)
Know your real profit, every week.

TruckersPro is a no-nonsense weekly money tracker built for truck drivers:

OWNER-OPERATORS & LEASE DRIVERS
• Log every load — earnings, TONU, and commission per load
• Track diesel and DEF fill-ups separately
• Confirmed expense fields: truck payment, insurance, trailer, IFTA, admin fees — weekly, monthly, or daily
• Add unlimited custom expenses by name (truck wash, parking, parts…)
• Odometer-based mileage with automatic $0.14/mi deduction
• A Net Profit dashboard that shows where every dollar went — tap any card for a full breakdown and week-over-week comparison

COMPANY DRIVERS
• Paid-per-mile: log paid miles × your cents-per-mile rate
• Commission: log load earnings × your percentage

BUILT FOR THE ROAD
• Works fully offline — data syncs automatically when you're back in coverage
• Week-by-week history, navigable from every screen
• Free. No ads. Your data is never sold.

One account, one driver type, zero clutter. Add your first load in under a minute.

## Category
Business

## Contact
fatihatak1907@gmail.com

## Privacy policy URL
https://fatihatak1907.github.io/TruckersPro/privacy.html

## Data safety form answers
- Does your app collect or share user data? YES, collects; NO sharing with third parties.
- Data types: Personal info → Email address (collected, required, App functionality / Account management; encrypted in transit; user can request deletion). Financial info → "Other financial info" (user-entered earnings/expenses; collected, optional in use, App functionality; encrypted in transit; deletable).
- Is all user data encrypted in transit? YES.
- Do you provide a way for users to request deletion? YES (email; stated in privacy policy).
- Independent security review? NO.

## Content rating questionnaire
Category: Utility/Productivity. No violence, no sexual content, no profanity, no controlled substances, no gambling, no user-generated public content, no location sharing, no personal-info sharing. Expected rating: Everyone.

## Screenshots (user takes on phone; min 2, aim for 6)
1. Dashboard with Net Profit + stat cards
2. Insights sheet open on Expenses (shows named other expenses)
3. Add Load with confirmed earnings field
4. Fuel screen
5. Expenses screen with locked fields + D/W/M entry
6. History list

## Feature graphic
store/feature-graphic.png (1024×500, generated)
```

- [ ] **Step 4: Create `store/launch-checklist.md`** — Phase B tracker:

```markdown
# TruckersPro — Android Launch Checklist (Phase B)

- [ ] 1. EAS link: `eas login` (user) → `eas init` → project linked
- [ ] 2. EAS env vars (production): `eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value <url>` and same for `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 3. GitHub Pages ON (master /docs) via `gh api` → https://fatihatak1907.github.io/TruckersPro/privacy.html returns 200
- [ ] 4. Preview build: `eas build --platform android --profile preview` → install APK on phone → smoke test: login, add load, confirm expense, insights sheet, offline add + resync
- [ ] 5. User: create Google Play developer account ($25, play.google.com/console) — identity verification may take ~1 day
- [ ] 6. Production build: `eas build --platform android --profile production` → .aab
- [ ] 7. Play Console: create app (TruckersPro, free, Business) → paste listing from store/listing.md → upload screenshots + feature graphic → data safety + content rating (answers in listing.md) → privacy URL
- [ ] 8. Upload .aab to CLOSED TESTING track → add ≥12 testers → run 14 continuous days (Google requirement for new personal accounts)
- [ ] 9. Tester invite message drafted & sent (Claude drafts when we reach this step)
- [ ] 10. Decide Supabase Pro ($25/mo) before public launch (free tier pauses after ~1 week inactivity)
- [ ] 11. Apply for production access → promote to production → LIVE
```

- [ ] **Step 5: Verify** — open both HTML files locally (Read them; check no external URLs are referenced, sections all present); `store/listing.md` character limits: title ≤30, short description ≤80 (count them).

- [ ] **Step 6: Commit**

```bash
git add docs/privacy.html docs/index.html docs/.nojekyll store/listing.md store/launch-checklist.md
git commit -m "docs: privacy policy, landing page, Play listing pack, launch checklist"
```

---

### Task 5 (controller-level): Review gates

- [ ] Security review of the whole app (auth flow, RLS reliance, secret hygiene: only `EXPO_PUBLIC_*` values may reach the JS bundle — `SUPABASE_ACCESS_TOKEN` in `.env` must be verified absent from any bundled code path; `.env` gitignored).
- [ ] Final whole-branch code review (launch-readiness lens).
- [ ] Fix findings, merge to master, push.

Phase B then proceeds via `store/launch-checklist.md` with the user.
