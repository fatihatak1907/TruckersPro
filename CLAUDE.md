# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo Version

This project uses **Expo SDK 54**. Read docs at https://docs.expo.dev/versions/v54.0.0/ before writing Expo-specific code.

## Commands

```bash
# Start dev server (scan QR with Expo Go)
npx expo start

# If Metro fails with ENOENT on hermes-estree/dist, run this fix then restart:
mkdir -p node_modules/@react-native/babel-preset/node_modules/hermes-estree
cp -r node_modules/hermes-estree/dist node_modules/@react-native/babel-preset/node_modules/hermes-estree/
cp node_modules/hermes-estree/package.json node_modules/@react-native/babel-preset/node_modules/hermes-estree/

# All tests
npm test

# Single test file
npx jest __tests__/syncEngine.test.ts

# Install packages — always pass --legacy-peer-deps
npm install <pkg> --legacy-peer-deps

# Type-check
npx tsc --noEmit
```

## Environment

`.env` at project root (gitignored) holds:
```
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```
Without these the app throws at startup (see `src/supabase/client.ts`). Reference template is `.env.example`.

For destructive Supabase changes (running schema SQL, toggling auth config) use the Management API with a `sbp_...` access token rather than asking the user to click through the dashboard. Project ref: `wuegzljzxnacssxzxfsh`. Endpoint: `https://api.supabase.com/v1/projects/{ref}/database/query` with `{"query": "..."}` body.

## Architecture

**Four driver modes** — `owner-op`, `lease`, `company-mile`, `company-commission`. Each user account is locked to exactly one driver type (chosen at signup, stored on `profiles.driver_type`, immutable post-signup).

| Mode | Tabs | Earnings formula |
|------|------|-----------------|
| `owner-op` / `lease` | Dashboard, AddLoad, Fuel, Expenses, History (5) | earnings + tonu − commission − fuel − weekly expenses − mileage deduction ($0.14/mi) |
| `company-mile` | Dashboard, AddLoad, History (3) | paidMileage × centsPerMile |
| `company-commission` | Dashboard, AddLoad, History (3) | earnings × commissionRate |

`owner-op` and `lease` share the same screens (`OwnerOpTabs` accepts a `driverType` prop). The difference is purely the displayed label.

### Three-layer data model

```
Screens → src/storage/storage.ts (AsyncStorage) → src/sync/syncEngine.ts → Supabase
```

**Screens never await the network.** They read/write only AsyncStorage; mutating storage calls enqueue a sync op that gets flushed to Supabase out-of-band. This is what makes the app feel instant and work in cell-signal dead zones.

- **Storage** (`src/storage/storage.ts`) wraps AsyncStorage. Keys:
  - `loads:{driverType}:{weekKey}` → `LoadEntry[]`
  - `expenses:{driverType}:{weekKey}` → `WeeklyExpenses`
  - `fuel:{driverType}:{weekKey}` → `FuelEntry[]`
  - `profile:name`, `profile:driver_type` — single row per user, no driver-type segment
  - `sync:queue`, `sync:migrated` — sync engine state

  `deleteLoad` removes the whole key when the last load for that week is deleted (no empty arrays in storage). `getAllWeekKeys(driverType)` scans all keys to build the history list. `wipeAll()` clears every app-owned key (used on sign-out).

- **Sync engine** (`src/sync/syncEngine.ts`) — persistent queue at `sync:queue`. `enqueue(op)` appends + fires a non-blocking flush. `flush()` is serialized (a single in-flight promise; concurrent callers await the same one — required to avoid the race a naive guard introduces). On failure, the op stays at the head of the queue with `attempts++` and `lastError` set, and the flush stops. `start()` subscribes to NetInfo + runs a 30s safety flush; called from `App.tsx` after bootstrap.

- **Migration** (`src/sync/migration.ts`) — `runMigrationAndPull(userId)` runs on every login: Path A (uploads local data if any + not yet migrated), then Path B (pulls Supabase rows into AsyncStorage). Sets `sync:migrated=true` when done.

- **Calculations** (`src/utils/calculations.ts`) are pure functions — no side effects, no storage access. All dashboard totals computed here. Every recurring expense in `WeeklyExpenses` has its own `*Frequency: 'weekly' | 'monthly'`; monthly amounts are divided by 4.33 to weekly equivalents at calculation time.

### Auth + routing

`App.tsx` is the auth gate. States:
- `loading` → splash with logo
- `signed-out` → `<AuthStack>` (Welcome → Login → Signup)
- `needs-profile` → `<PickDriverTypeScreen>` (recovery for orphaned profiles)
- `migrating` → "Loading your data…" overlay
- `ready` → `<WeekProvider>` wrapping the matching tab navigator
- `error` → retry screen

On launch, App.tsx calls `supabase.auth.getUser()` (not `getSession()`) so stale tokens for deleted users get caught and signed out. After `SIGNED_IN`, `bootstrap()` fetches the user's `profiles` row (with a short retry loop because SignupScreen inserts the profile right as the event fires — the race is real), runs migration+pull, starts the sync engine, and mounts the driver-type-matching tab navigator. There is no in-app driver-type picker; the choice is locked at signup.

### Supabase schema

Five tables, all RLS-scoped to `auth.uid() = user_id`:
- `profiles` — `(user_id PK, driver_type, name, …)` — one row per user
- `loads` — `(id UUID PK, user_id, week_key, driver_type, …)`
- `fuel_entries` — same key shape as loads
- `weekly_expenses` — composite PK `(user_id, driver_type, week_key)`. Each recurring expense has its own `*_frequency` text column (default `'weekly'`).
- `auth.users` (Supabase-managed)

Reference SQL: `src/supabase/schema.sql` (initial) + `src/supabase/schema-v2.sql` (single-row profiles + per-expense frequency columns).

## Conventions

- **Week key** is always `YYYY-MM-DD` of that week's Monday. `src/utils/weekKey.ts` computes it. `WeekContext` (`src/context/WeekContext.tsx`) holds the active week + `goToPrev` / `goToNext` / `formatWeekDisplay(weekKey)`. All tab screens read the same `weekKey` — changing it on one screen updates them all.

- **Theme** (`src/theme.ts`) — dark palette via `C.*`. Background `C.bg`, cards `C.card`/`C.cardElevated`, single accent `C.accent` (yellow `#FFD600`) with `C.accentText` (black) for text on yellow. Status: `C.success` (green), `C.danger` (red). No gradient headers — flat dark only. `C.gradStart` / `C.gradEnd` exist as backwards-compat aliases but should not be used in new code.

- **Headers** — every in-app screen uses `<ScreenHeader title=… subtitle=… right={…} onPress={…} />` from `src/components/ScreenHeader.tsx`. The optional `onPress` makes the title/subtitle tappable (Dashboards use it to wire `handleEditName`). Logos render inline at 48×48 unless a `left` slot overrides.

- **TabBar** — custom floating-pill bar (`src/navigation/TabBar.tsx`) rendered via React Navigation's `tabBar` prop on each tab navigator. The active tab has a yellow `C.accent` circle behind the icon. Screens add `paddingBottom: 120-140` to their ScrollView contentContainerStyle so the tab bar doesn't overlap content.

- **Sign-out** — `confirmAndSignOut()` in `src/utils/signOut.ts` is the single source of truth. The `<SignOutButton />` component renders in the right slot of every Dashboard's ScreenHeader.

- **AddLoad edit state** — Add Load screens use `useFocusEffect` + `useCallback([editLoad?.id])` to reset fields on focus. After saving, always call `navigation.setParams({ load: undefined })` before navigating away so the next focus doesn't re-load the just-saved load.

- **TONU-only saves** are allowed for owner-op/lease: if `tonu > 0`, earnings and commissionRate aren't required (both default to `0`).

- **uuid + crypto** — `uuid` v14 needs `react-native-get-random-values` imported before any uuid call. It's imported as the very first line of `index.ts`. Don't reorder that.

## Component definition rule

Never define React components (functions used as `<Component />`) inside another component's function body — this causes remounting on every render and breaks `TextInput` focus. Define them at module scope, or call them as plain functions (`renderField()`) if they need closure over local state.

## Tests

Live in `__tests__/`. Coverage: `calculations.ts`, `storage.ts`, `weekKey.ts`, `syncEngine.ts`, `migration.ts`. AsyncStorage is mocked via `@react-native-async-storage/async-storage/jest/async-storage-mock` (each test file calls `jest.mock(...)` inline — no global setup). Supabase + NetInfo are mocked per-file.

The suite must be fully green — a failing test blocks merges and releases.

## Assets

The app logo is `logo.png` in the project root (not in `assets/`). Referenced from screens as `require('../../logo.png')` and from `App.tsx` as `require('./logo.png')`. All store/launcher assets regenerate from it via `node scripts/gen-assets.js`. The welcome screen background is `assets/welcome-bg.jpg` (currently a jpeg copy of the logo).

## Process notes

The `docs/superpowers/specs/` and `docs/superpowers/plans/` directories hold the spec + plan for each major feature shipped (Supabase auth + sync, signup/password + dark theme). When picking up a feature mid-stream or doing a follow-up, start there for context — they capture the *why* behind the current architecture.
