# Supabase Backend, Phone Auth & Offline-First Sync — Design

**Date:** 2026-05-26
**Status:** Approved (pending review)

## Goal

Add a Supabase Postgres backend, phone-OTP authentication, and an offline-first local cache so that:

1. Each user's data is scoped to their account and synced across devices
2. Writes feel instant — the app never blocks on the network
3. The app remains fully usable in cell-signal dead zones
4. Existing AsyncStorage data on a phone is migrated into the new user's account on first login

## Non-Goals

- Real-time multi-device sync (push notifications, websockets). Sync is pull-on-launch + flush-on-write.
- Per-driver-type accounts. One user has one account; the account holds data for all four driver types.
- Conflict resolution beyond last-write-wins. The app is single-user-multi-device, so concurrent edits are rare and acceptable to lose silently.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Screens (Dashboard, AddLoad, Fuel, Expenses, etc.)  │
│  — unchanged: still call storage.ts functions        │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│  src/storage/storage.ts (AsyncStorage)               │
│  — every write also enqueues a sync op               │
│  — reads are unchanged (instant, local)              │
└──────────────────────────────────────────────────────┘
                         │ enqueue
                         ▼
┌──────────────────────────────────────────────────────┐
│  src/sync/syncEngine.ts                              │
│  — persistent queue in AsyncStorage                  │
│  — flushes to Supabase when online + signed in       │
│  — retries with backoff on failure                   │
└──────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│  Supabase (Postgres + Auth)                          │
│  — RLS: every row scoped to auth.uid()               │
└──────────────────────────────────────────────────────┘
```

**Invariant:** screens never await the network. They write to AsyncStorage and return immediately. Sync happens out-of-band.

## Authentication

**Method:** phone number + SMS OTP via Supabase Auth.

**New screen:** `src/screens/AuthScreen.tsx`, shown when no session exists. Two stages:

1. **Phone entry** — input with country code (default `+1`) → "Send Code" → `supabase.auth.signInWithOtp({ phone })`
2. **OTP entry** — 6-digit code from SMS → "Verify" → `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`

**Session handling:**

- Supabase JS client is configured with an AsyncStorage adapter, so sessions persist across restarts
- On app launch, `App.tsx` calls `supabase.auth.getSession()`:
  - Session present → render `AppNavigator`
  - No session → render `<AuthScreen />`
- A `supabase.auth.onAuthStateChange` listener flips between the two
- "Sign out" button (small icon, top-right of `HomeScreen`) clears the session and wipes local data

**Edge cases:**

- Wrong code → show "Invalid or expired code"
- Resend code → 30-second cooldown before "Resend" becomes tappable
- Phone format → normalize to E.164 (`+15551234567`) before sending
- OTP send rate-limited → inline error, keep input populated

## Supabase Schema

Four tables, all keyed by `user_id` (UUID from `auth.users`). RLS scopes every row to `auth.uid() = user_id`.

```sql
-- loads
create table loads (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  week_key text not null,
  driver_type text not null,
  start_location text not null,
  end_location text not null,
  earnings numeric,
  tonu numeric,
  commission_rate numeric,
  paid_mileage numeric,
  cents_per_mile numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- fuel_entries
create table fuel_entries (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  week_key text not null,
  driver_type text not null,         -- 'owner-op' or 'lease'
  type text not null,                -- 'diesel' | 'def'
  cost numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- weekly_expenses (composite PK)
create table weekly_expenses (
  user_id uuid not null references auth.users on delete cascade,
  driver_type text not null,
  week_key text not null,
  truck_payment numeric not null default 0,
  truck_payment_frequency text not null default 'weekly',
  truck_insurance numeric not null default 0,
  trailer_insurance numeric not null default 0,
  trailer_lease numeric not null default 0,
  ifta_cost numeric not null default 0,
  admin_fee numeric not null default 0,
  other numeric not null default 0,
  start_odometer numeric not null default 0,
  end_odometer numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, driver_type, week_key)
);

-- profiles
create table profiles (
  user_id uuid not null references auth.users on delete cascade,
  driver_type text not null,
  name text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, driver_type)
);

-- RLS (applied to all four tables, same pattern)
alter table loads enable row level security;
create policy "own rows" on loads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Notes:**

- `id` for loads/fuel uses the existing client-generated IDs, cast/regenerated as UUIDs during migration if they aren't already valid UUIDs.
- `updated_at` is server-set (`default now()`) — clients never trust client clocks for conflict resolution.
- `on delete cascade` — deleting an auth user wipes all their data.

## Local Storage Layer

`src/storage/storage.ts` keeps its current shape. Screens are unchanged.

**1. Every mutating function enqueues a sync op** after the AsyncStorage write succeeds:

```ts
// inside saveLoad
await AsyncStorage.setItem(loadsKey(driverType, weekKey), JSON.stringify(loads));
syncEngine.enqueue({ kind: 'upsertLoad', payload: load });
```

Functions that enqueue: `saveLoad`, `deleteLoad`, `saveWeeklyExpenses`, `saveFuelEntry`, `deleteFuelEntry`, `deleteWeekData`, `saveProfileName`.

**2. New function `pullFromSupabase(userId)`** — fetches every row for the user across all four tables and overwrites local AsyncStorage. Used on fresh installs / new devices.

**Reads stay unchanged.** `getLoadsForWeek`, `getWeeklyExpenses`, etc. continue to read only from AsyncStorage.

**No `user_id` in local keys.** Local storage is implicitly scoped to "the currently signed-in user." On sign-out the app wipes AsyncStorage so the next user starts clean.

## Sync Engine

`src/sync/syncEngine.ts` — one responsibility: drain a queue of pending ops to Supabase.

**Operation shape:**

```ts
type SyncOp =
  | { kind: 'upsertLoad'; payload: LoadEntry }
  | { kind: 'deleteLoad'; payload: { id: string } }
  | { kind: 'upsertFuel'; payload: FuelEntry & { driverType: string } }
  | { kind: 'deleteFuel'; payload: { id: string } }
  | { kind: 'upsertExpenses'; payload: WeeklyExpenses & { driverType: string } }
  | { kind: 'deleteWeek'; payload: { driverType: string; weekKey: string } }
  | { kind: 'upsertProfile'; payload: { driverType: string; name: string } };

type QueuedOp = {
  id: string;
  op: SyncOp;
  attempts: number;
  lastError?: string;
  createdAt: string;
};
```

**Queue storage:** a single AsyncStorage key `sync:queue` → `QueuedOp[]`. Persistent across restarts.

**API:**

- `enqueue(op)` — append + trigger a non-blocking flush. Storage layer never blocks.
- `flush()` — process queue head-to-tail, one op at a time:
  1. Send to Supabase (upsert or delete on the matching table, scoped by `user_id`)
  2. On success → remove from queue, continue
  3. On failure → increment `attempts`, write `lastError`, stop flushing (try again later)
- `start()` — called on app launch after auth restored. Subscribes to `NetInfo` connectivity changes (flush on reconnect). Also runs a flush every 30 seconds as a safety net.

**Conflict resolution:** all Supabase writes use `upsert` with `updated_at = now()` (server-set). Last write wins.

**Failure visibility:**

- "syncing…" pill in dashboard header when queue is non-empty
- Red "sync error" badge after 3 consecutive failures on the same op; tapping it shows a retry button
- Failed ops stay in the queue forever until they succeed or the user manually clears them — no silent data loss

## First-Login Migration & Multi-Device Pull

Triggered right after a successful OTP verify.

**Path A — First login on a phone with existing local data**

Detection: AsyncStorage contains data keys (`loads:*`, `expenses:*`, etc.) but no `sync:migrated` flag.

1. Show a one-time "Uploading your data…" overlay (blocks UI)
2. Read every local row, enqueue an `upsert*` op for each (loads, fuel, expenses, profiles)
3. Flush the queue synchronously (await) so the user sees confirmation before continuing
4. Set `sync:migrated = true` in AsyncStorage
5. Then run Path B's pull (the account may have data from another device — server `updated_at` decides winner)

**Path B — Login on a fresh device (or after re-install)**

Detection: no local data keys, or `sync:migrated` is already set.

1. Show "Loading your data…" overlay
2. `pullFromSupabase(userId)` fetches every row across all 4 tables
3. Write all rows into AsyncStorage using existing storage keys
4. Set `sync:migrated = true`
5. Navigate to `HomeScreen`

**Sign-out:**

- Clear the Supabase session
- Wipe AsyncStorage: loads, expenses, fuel, profiles, queue, migrated flag
- Navigate back to `AuthScreen`

## Edge Cases

- **App killed mid-sync** → ops survive (persisted), flushed on next launch
- **Different account on same device** → wipe local first, then pull
- **Clock skew** → `updated_at` is set server-side, never trusted from client
- **Concurrent edits on two devices** → last device to come online wins (acceptable for single-user app)
- **Pull fails on fresh device** → blocking error screen with retry button (otherwise the user sees an empty app and assumes data is lost)
- **Migration fails partway** → ops remain in queue, `sync:migrated` stays false, retried on next launch

## Testing

- `syncEngine.test.ts` — queue persistence, retry on failure, flush on reconnect (mock Supabase + NetInfo)
- `storage.test.ts` — existing tests + assertions that mutating functions enqueue the right op
- `migration.test.ts` — Path A (local → Supabase) and Path B (Supabase → local) with mocked Supabase client
- `calculations.test.ts` — unchanged, still pure
- Auth screens — manual QA only (real SMS infrastructure), no automated tests

## Dependencies

```
@supabase/supabase-js
@react-native-community/netinfo
react-native-url-polyfill
```

Installed with `--legacy-peer-deps` per project convention.

## File Layout

```
src/
  supabase/
    client.ts            # Supabase client init with AsyncStorage adapter
    schema.sql           # Reference copy of the DDL
  sync/
    syncEngine.ts        # Queue + flush
    migration.ts         # Path A + Path B
  screens/
    AuthScreen.tsx       # Phone + OTP
  storage/
    storage.ts           # Existing + enqueue hooks + pullFromSupabase + wipeAll
App.tsx                  # Wires auth gate + sync start
```

## Environment Configuration

- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env` (gitignored)
- Loaded via `process.env.EXPO_PUBLIC_*` (Expo SDK 54 supports this natively)

## Out of Scope (future work)

- Real-time updates (websocket subscriptions to Supabase Realtime)
- Account deletion UI (would call a Supabase edge function)
- Password recovery (N/A — phone OTP has no password)
- Multi-account switching on one device
