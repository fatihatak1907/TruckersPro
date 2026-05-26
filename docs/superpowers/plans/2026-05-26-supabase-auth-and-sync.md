# Supabase Backend, Phone Auth & Offline-First Sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase backend with phone-OTP auth and an offline-first sync engine so each user's data is scoped to their account and writes feel instant even with no signal.

**Architecture:** Three layers — screens still talk only to AsyncStorage (`storage.ts`); every mutating storage call enqueues a sync op; a sync engine flushes the queue to Supabase whenever the device is online and signed in.

**Tech Stack:** React Native / Expo SDK 54, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, Jest.

**Spec:** [docs/superpowers/specs/2026-05-26-supabase-auth-and-sync-design.md](../specs/2026-05-26-supabase-auth-and-sync-design.md)

---

## Task 1: Add dependencies and env scaffolding

**Files:**
- Modify: `package.json`
- Create: `.env.example`
- Modify: `.gitignore` (ensure `.env` is ignored)

- [ ] **Step 1: Install Supabase + NetInfo + URL polyfill**

Run from project root:

```bash
npm install @supabase/supabase-js @react-native-community/netinfo react-native-url-polyfill --legacy-peer-deps
```

Expected: three packages added to `package.json` `dependencies`.

- [ ] **Step 2: Create `.env.example`**

Create `.env.example` at project root with this content:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

- [ ] **Step 3: Ensure `.env` is gitignored**

Open `.gitignore`. If `.env` is not already listed, add a new line:

```
.env
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "chore: add supabase, netinfo, url-polyfill deps + env scaffolding"
```

---

## Task 2: Create Supabase project + deploy schema

This task is **manual** (uses the Supabase web dashboard). The agent should pause and prompt the user to complete it before continuing.

**Files:**
- Create: `src/supabase/schema.sql`

- [ ] **Step 1: Write the schema file**

Create `src/supabase/schema.sql` with this content:

```sql
-- loads
create table if not exists loads (
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
create index if not exists loads_user_week_idx on loads (user_id, week_key);

-- fuel_entries
create table if not exists fuel_entries (
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,
  week_key text not null,
  driver_type text not null,
  type text not null,
  cost numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists fuel_user_week_idx on fuel_entries (user_id, week_key);

-- weekly_expenses
create table if not exists weekly_expenses (
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
create table if not exists profiles (
  user_id uuid not null references auth.users on delete cascade,
  driver_type text not null,
  name text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, driver_type)
);

-- RLS
alter table loads enable row level security;
alter table fuel_entries enable row level security;
alter table weekly_expenses enable row level security;
alter table profiles enable row level security;

create policy "own rows" on loads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on fuel_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on weekly_expenses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Ask the user to set up Supabase**

Prompt the user with these exact instructions:

> **Manual setup required.** Before we continue I need you to:
>
> 1. Go to https://supabase.com and create a free project (or use an existing one).
> 2. In the project dashboard, open **SQL Editor** → **New query**, paste the contents of `src/supabase/schema.sql`, and click **Run**.
> 3. Open **Authentication** → **Providers** → enable **Phone**. (You'll need to add a Twilio account SID + auth token + messaging service SID for SMS to work. Supabase docs: https://supabase.com/docs/guides/auth/phone-login)
> 4. Copy your project's **URL** and **anon public key** from **Settings** → **API**.
> 5. Create `.env` at the project root (do NOT commit it) with:
>    ```
>    EXPO_PUBLIC_SUPABASE_URL=...
>    EXPO_PUBLIC_SUPABASE_ANON_KEY=...
>    ```
> 6. Reply "done" when complete.

Wait for the user to confirm before continuing.

- [ ] **Step 3: Commit the schema file**

```bash
git add src/supabase/schema.sql
git commit -m "feat: add supabase schema with RLS for all tables"
```

---

## Task 3: Supabase client module

**Files:**
- Create: `src/supabase/client.ts`
- Modify: `index.ts` (or `App.tsx` — wherever the app entry is) to import the URL polyfill

- [ ] **Step 1: Create the client**

Create `src/supabase/client.ts`:

```ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

- [ ] **Step 2: Add URL polyfill to entry**

Open `index.ts`. If the first line is not already `import 'react-native-url-polyfill/auto';`, add it as the very first line (before the `App` import).

- [ ] **Step 3: Verify the app still builds**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/supabase/client.ts index.ts
git commit -m "feat: add supabase client with AsyncStorage session persistence"
```

---

## Task 4: Define sync op types

**Files:**
- Create: `src/sync/types.ts`

- [ ] **Step 1: Create the types module**

Create `src/sync/types.ts`:

```ts
import type { LoadEntry, FuelEntry, WeeklyExpenses } from '../types';

export type SyncOp =
  | { kind: 'upsertLoad'; payload: LoadEntry }
  | { kind: 'deleteLoad'; payload: { id: string } }
  | { kind: 'upsertFuel'; payload: FuelEntry & { driverType: string } }
  | { kind: 'deleteFuel'; payload: { id: string } }
  | { kind: 'upsertExpenses'; payload: WeeklyExpenses & { driverType: string } }
  | { kind: 'deleteWeek'; payload: { driverType: string; weekKey: string } }
  | { kind: 'upsertProfile'; payload: { driverType: string; name: string } };

export type QueuedOp = {
  id: string;            // uuid for the queued op itself
  op: SyncOp;
  attempts: number;
  lastError?: string;
  createdAt: string;
};

export const SYNC_QUEUE_KEY = 'sync:queue';
export const SYNC_MIGRATED_KEY = 'sync:migrated';
```

- [ ] **Step 2: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/sync/types.ts
git commit -m "feat: define sync op + queue types"
```

---

## Task 5: Sync engine — enqueue (TDD)

**Files:**
- Create: `__tests__/syncEngine.test.ts`
- Create: `src/sync/syncEngine.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/syncEngine.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncEngine } from '../src/sync/syncEngine';
import { SYNC_QUEUE_KEY } from '../src/sync/types';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

jest.mock('../src/supabase/client', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null } })) },
    from: jest.fn(),
  },
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  syncEngine.__resetForTests();
});

test('enqueue persists op to AsyncStorage', async () => {
  await syncEngine.enqueue({
    kind: 'upsertLoad',
    payload: {
      id: 'load-1',
      weekKey: '2026-05-25',
      driverType: 'owner-op',
      startLocation: 'A',
      endLocation: 'B',
      createdAt: '2026-05-25T12:00:00Z',
    } as any,
  });

  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  const queue = JSON.parse(raw!);
  expect(queue).toHaveLength(1);
  expect(queue[0].op.kind).toBe('upsertLoad');
  expect(queue[0].op.payload.id).toBe('load-1');
  expect(queue[0].attempts).toBe(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx jest __tests__/syncEngine.test.ts
```

Expected: FAIL — "Cannot find module '../src/sync/syncEngine'".

- [ ] **Step 3: Implement enqueue**

Create `src/sync/syncEngine.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncOp, QueuedOp, SYNC_QUEUE_KEY } from './types';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function readQueue(): Promise<QueuedOp[]> {
  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
}

async function writeQueue(q: QueuedOp[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q));
}

async function enqueue(op: SyncOp): Promise<void> {
  const queue = await readQueue();
  queue.push({
    id: uid(),
    op,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
  // non-blocking flush trigger — implemented in a later task
}

function __resetForTests() {
  // no in-memory state yet; placeholder for later tasks
}

export const syncEngine = {
  enqueue,
  __resetForTests,
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest __tests__/syncEngine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add __tests__/syncEngine.test.ts src/sync/syncEngine.ts
git commit -m "feat(sync): enqueue persists ops to AsyncStorage"
```

---

## Task 6: Sync engine — flush success path (TDD)

**Files:**
- Modify: `__tests__/syncEngine.test.ts`
- Modify: `src/sync/syncEngine.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/syncEngine.test.ts` (below the existing test):

```ts
test('flush sends queued upsertLoad to supabase and removes it on success', async () => {
  const upsertMock = jest.fn(() => Promise.resolve({ error: null }));
  const fromMock = jest.fn(() => ({ upsert: upsertMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(fromMock);
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
  });

  await syncEngine.enqueue({
    kind: 'upsertLoad',
    payload: {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
    } as any,
  });

  await syncEngine.flush();

  expect(fromMock).toHaveBeenCalledWith('loads');
  expect(upsertMock).toHaveBeenCalledTimes(1);
  expect(upsertMock.mock.calls[0][0]).toMatchObject({
    id: 'load-1', user_id: 'user-1', week_key: '2026-05-25', driver_type: 'owner-op',
    start_location: 'A', end_location: 'B',
  });

  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  const queue = JSON.parse(raw!);
  expect(queue).toHaveLength(0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest __tests__/syncEngine.test.ts -t "flush sends queued"
```

Expected: FAIL — `syncEngine.flush is not a function`.

- [ ] **Step 3: Implement flush + dispatchers**

Replace the contents of `src/sync/syncEngine.ts` with:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';
import { SyncOp, QueuedOp, SYNC_QUEUE_KEY } from './types';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function readQueue(): Promise<QueuedOp[]> {
  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
}

async function writeQueue(q: QueuedOp[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q));
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function dispatch(op: SyncOp, userId: string): Promise<void> {
  switch (op.kind) {
    case 'upsertLoad': {
      const l = op.payload;
      const { error } = await supabase.from('loads').upsert({
        id: l.id,
        user_id: userId,
        week_key: l.weekKey,
        driver_type: l.driverType,
        start_location: l.startLocation,
        end_location: l.endLocation,
        earnings: l.earnings ?? null,
        tonu: l.tonu ?? null,
        commission_rate: l.commissionRate ?? null,
        paid_mileage: l.paidMileage ?? null,
        cents_per_mile: l.centsPerMile ?? null,
        created_at: l.createdAt,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }
    case 'deleteLoad': {
      const { error } = await supabase.from('loads').delete()
        .eq('user_id', userId).eq('id', op.payload.id);
      if (error) throw new Error(error.message);
      return;
    }
    case 'upsertFuel': {
      const f = op.payload;
      const { error } = await supabase.from('fuel_entries').upsert({
        id: f.id,
        user_id: userId,
        week_key: f.weekKey,
        driver_type: f.driverType,
        type: f.type,
        cost: f.cost,
        created_at: f.createdAt,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }
    case 'deleteFuel': {
      const { error } = await supabase.from('fuel_entries').delete()
        .eq('user_id', userId).eq('id', op.payload.id);
      if (error) throw new Error(error.message);
      return;
    }
    case 'upsertExpenses': {
      const e = op.payload;
      const { error } = await supabase.from('weekly_expenses').upsert({
        user_id: userId,
        driver_type: e.driverType,
        week_key: e.weekKey,
        truck_payment: e.truckPayment,
        truck_payment_frequency: e.truckPaymentFrequency,
        truck_insurance: e.truckInsurance,
        trailer_insurance: e.trailerInsurance,
        trailer_lease: e.trailerLease,
        ifta_cost: e.iftaCost,
        admin_fee: e.adminFee,
        other: e.other,
        start_odometer: e.startOdometer,
        end_odometer: e.endOdometer,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }
    case 'deleteWeek': {
      const { driverType, weekKey } = op.payload;
      const [a, b, c] = await Promise.all([
        supabase.from('loads').delete()
          .eq('user_id', userId).eq('driver_type', driverType).eq('week_key', weekKey),
        supabase.from('fuel_entries').delete()
          .eq('user_id', userId).eq('driver_type', driverType).eq('week_key', weekKey),
        supabase.from('weekly_expenses').delete()
          .eq('user_id', userId).eq('driver_type', driverType).eq('week_key', weekKey),
      ]);
      const err = a.error ?? b.error ?? c.error;
      if (err) throw new Error(err.message);
      return;
    }
    case 'upsertProfile': {
      const { error } = await supabase.from('profiles').upsert({
        user_id: userId,
        driver_type: op.payload.driverType,
        name: op.payload.name,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }
  }
}

let flushing = false;

async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    const userId = await getUserId();
    if (!userId) return;
    let queue = await readQueue();
    while (queue.length > 0) {
      const head = queue[0];
      try {
        await dispatch(head.op, userId);
        queue = queue.slice(1);
        await writeQueue(queue);
      } catch (err: any) {
        head.attempts += 1;
        head.lastError = err?.message ?? String(err);
        queue[0] = head;
        await writeQueue(queue);
        return; // stop on first failure
      }
    }
  } finally {
    flushing = false;
  }
}

async function enqueue(op: SyncOp): Promise<void> {
  const queue = await readQueue();
  queue.push({
    id: uid(),
    op,
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
  flush().catch(() => {});
}

function __resetForTests() {
  flushing = false;
}

export const syncEngine = {
  enqueue,
  flush,
  __resetForTests,
};
```

- [ ] **Step 4: Run all syncEngine tests**

```bash
npx jest __tests__/syncEngine.test.ts
```

Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add __tests__/syncEngine.test.ts src/sync/syncEngine.ts
git commit -m "feat(sync): flush dispatches ops to supabase and clears queue on success"
```

---

## Task 7: Sync engine — failure & retry (TDD)

**Files:**
- Modify: `__tests__/syncEngine.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `__tests__/syncEngine.test.ts`:

```ts
test('flush leaves op in queue and records error on failure', async () => {
  const upsertMock = jest.fn(() => Promise.resolve({ error: { message: 'boom' } }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({ upsert: upsertMock }));
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  await syncEngine.enqueue({
    kind: 'upsertLoad',
    payload: {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
    } as any,
  });

  await syncEngine.flush();

  const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
  expect(queue).toHaveLength(1);
  expect(queue[0].attempts).toBe(1);
  expect(queue[0].lastError).toBe('boom');
});

test('flush is a no-op when no user is signed in', async () => {
  const upsertMock = jest.fn(() => Promise.resolve({ error: null }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({ upsert: upsertMock }));
  supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

  await syncEngine.enqueue({
    kind: 'upsertLoad',
    payload: {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
    } as any,
  });
  await syncEngine.flush();

  expect(upsertMock).not.toHaveBeenCalled();
  const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
  expect(queue).toHaveLength(1);
});
```

- [ ] **Step 2: Run the tests**

```bash
npx jest __tests__/syncEngine.test.ts
```

Expected: PASS (both new tests pass — failure handling and no-user handling are already implemented in Task 6).

- [ ] **Step 3: Commit**

```bash
git add __tests__/syncEngine.test.ts
git commit -m "test(sync): cover failure-leaves-in-queue and signed-out no-op"
```

---

## Task 8: Sync engine — start() with NetInfo + interval

**Files:**
- Modify: `src/sync/syncEngine.ts`

- [ ] **Step 1: Add start() and queue size helper**

In `src/sync/syncEngine.ts`, add these imports at the top:

```ts
import NetInfo from '@react-native-community/netinfo';
```

Add inside the module body (before `export const syncEngine`):

```ts
let netUnsub: (() => void) | null = null;
let intervalId: any = null;

async function getQueueSize(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

function start(): void {
  if (netUnsub) return; // already started
  netUnsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) flush().catch(() => {});
  });
  intervalId = setInterval(() => {
    flush().catch(() => {});
  }, 30_000);
  flush().catch(() => {});
}

function stop(): void {
  if (netUnsub) { netUnsub(); netUnsub = null; }
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}
```

Update the `__resetForTests` function to:

```ts
function __resetForTests() {
  flushing = false;
  stop();
}
```

Update the export to:

```ts
export const syncEngine = {
  enqueue,
  flush,
  start,
  stop,
  getQueueSize,
  __resetForTests,
};
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all sync tests**

```bash
npx jest __tests__/syncEngine.test.ts
```

Expected: PASS (all 4 tests).

- [ ] **Step 4: Commit**

```bash
git add src/sync/syncEngine.ts
git commit -m "feat(sync): start() subscribes to NetInfo + runs 30s safety flush"
```

---

## Task 9: Hook storage writes into the sync queue

**Files:**
- Modify: `src/storage/storage.ts`
- Modify: `__tests__/storage.test.ts`

- [ ] **Step 1: Read the current storage.ts**

Open `src/storage/storage.ts` and identify the 7 mutating functions:
- `saveLoad(driverType, load)`
- `deleteLoad(driverType, weekKey, loadId)`
- `saveWeeklyExpenses(driverType, expenses)`
- `saveFuelEntry(driverType, entry)`
- `deleteFuelEntry(driverType, weekKey, entryId)`
- `deleteWeekData(driverType, weekKey)`
- `saveProfileName(driverType, name)`

- [ ] **Step 2: Write the failing test**

Add to `__tests__/storage.test.ts` (at the bottom):

```ts
import { syncEngine } from '../src/sync/syncEngine';
import { SYNC_QUEUE_KEY } from '../src/sync/types';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: false })),
}));
jest.mock('../src/supabase/client', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null } })) },
    from: jest.fn(),
  },
}));

describe('storage enqueues sync ops', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    syncEngine.__resetForTests();
  });

  test('saveLoad enqueues an upsertLoad op', async () => {
    const { saveLoad } = require('../src/storage/storage');
    await saveLoad('owner-op', {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
      earnings: 100,
    });
    const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
    expect(queue).toHaveLength(1);
    expect(queue[0].op).toMatchObject({ kind: 'upsertLoad', payload: { id: 'load-1' } });
  });

  test('deleteLoad enqueues a deleteLoad op', async () => {
    const { saveLoad, deleteLoad } = require('../src/storage/storage');
    await saveLoad('owner-op', {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
    });
    await deleteLoad('owner-op', '2026-05-25', 'load-1');
    const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
    const last = queue[queue.length - 1];
    expect(last.op.kind).toBe('deleteLoad');
    expect(last.op.payload.id).toBe('load-1');
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npx jest __tests__/storage.test.ts -t "storage enqueues"
```

Expected: FAIL — no enqueue is happening.

- [ ] **Step 4: Add the enqueue calls**

In `src/storage/storage.ts`, add at the top:

```ts
import { syncEngine } from '../sync/syncEngine';
```

Then add a `syncEngine.enqueue(...)` call **after the successful AsyncStorage write** in each mutating function:

- In `saveLoad(driverType, load)`, after `AsyncStorage.setItem(...)`:

```ts
syncEngine.enqueue({ kind: 'upsertLoad', payload: load });
```

- In `deleteLoad(driverType, weekKey, loadId)`, after the AsyncStorage write/delete:

```ts
syncEngine.enqueue({ kind: 'deleteLoad', payload: { id: loadId } });
```

- In `saveWeeklyExpenses(driverType, expenses)`, after the AsyncStorage write:

```ts
syncEngine.enqueue({ kind: 'upsertExpenses', payload: { ...expenses, driverType } });
```

- In `saveFuelEntry(driverType, entry)`, after the AsyncStorage write:

```ts
syncEngine.enqueue({ kind: 'upsertFuel', payload: { ...entry, driverType } });
```

- In `deleteFuelEntry(driverType, weekKey, entryId)`, after the AsyncStorage write:

```ts
syncEngine.enqueue({ kind: 'deleteFuel', payload: { id: entryId } });
```

- In `deleteWeekData(driverType, weekKey)`, after the AsyncStorage deletes:

```ts
syncEngine.enqueue({ kind: 'deleteWeek', payload: { driverType, weekKey } });
```

- In `saveProfileName(driverType, name)`, after the AsyncStorage write:

```ts
syncEngine.enqueue({ kind: 'upsertProfile', payload: { driverType, name } });
```

- [ ] **Step 5: Run the tests**

```bash
npx jest __tests__/storage.test.ts
```

Expected: PASS (all storage tests, including the two new ones).

- [ ] **Step 6: Commit**

```bash
git add src/storage/storage.ts __tests__/storage.test.ts
git commit -m "feat(storage): every mutating call enqueues a sync op"
```

---

## Task 10: pullFromSupabase + wipeAll helpers

**Files:**
- Modify: `src/storage/storage.ts`

- [ ] **Step 1: Add wipeAll**

In `src/storage/storage.ts`, add (export):

```ts
import { SYNC_QUEUE_KEY, SYNC_MIGRATED_KEY } from '../sync/types';

export async function wipeAll(): Promise<void> {
  const all = await AsyncStorage.getAllKeys();
  const ours = all.filter((k) =>
    k.startsWith('loads:') ||
    k.startsWith('expenses:') ||
    k.startsWith('fuel:') ||
    k.startsWith('profile:') ||
    k === SYNC_QUEUE_KEY ||
    k === SYNC_MIGRATED_KEY
  );
  if (ours.length) await AsyncStorage.multiRemove(ours);
}
```

- [ ] **Step 2: Add pullFromSupabase**

Add to `src/storage/storage.ts`:

```ts
import { supabase } from '../supabase/client';
import type { LoadEntry, FuelEntry, WeeklyExpenses } from '../types';

export async function pullFromSupabase(userId: string): Promise<void> {
  const [loadsRes, fuelRes, expRes, profRes] = await Promise.all([
    supabase.from('loads').select('*').eq('user_id', userId),
    supabase.from('fuel_entries').select('*').eq('user_id', userId),
    supabase.from('weekly_expenses').select('*').eq('user_id', userId),
    supabase.from('profiles').select('*').eq('user_id', userId),
  ]);
  const err = loadsRes.error ?? fuelRes.error ?? expRes.error ?? profRes.error;
  if (err) throw new Error(err.message);

  // Group loads by (driverType, weekKey)
  const loadsByKey: Record<string, LoadEntry[]> = {};
  for (const row of loadsRes.data ?? []) {
    const load: LoadEntry = {
      id: row.id,
      weekKey: row.week_key,
      driverType: row.driver_type,
      startLocation: row.start_location,
      endLocation: row.end_location,
      createdAt: row.created_at,
      earnings: row.earnings ?? undefined,
      tonu: row.tonu ?? undefined,
      commissionRate: row.commission_rate ?? undefined,
      paidMileage: row.paid_mileage ?? undefined,
      centsPerMile: row.cents_per_mile ?? undefined,
    };
    const k = `loads:${row.driver_type}:${row.week_key}`;
    (loadsByKey[k] ||= []).push(load);
  }
  for (const [k, arr] of Object.entries(loadsByKey)) {
    await AsyncStorage.setItem(k, JSON.stringify(arr));
  }

  // Group fuel by (driverType, weekKey)
  const fuelByKey: Record<string, FuelEntry[]> = {};
  for (const row of fuelRes.data ?? []) {
    const entry: FuelEntry = {
      id: row.id,
      weekKey: row.week_key,
      type: row.type,
      cost: Number(row.cost),
      createdAt: row.created_at,
    };
    const k = `fuel:${row.driver_type}:${row.week_key}`;
    (fuelByKey[k] ||= []).push(entry);
  }
  for (const [k, arr] of Object.entries(fuelByKey)) {
    await AsyncStorage.setItem(k, JSON.stringify(arr));
  }

  // Weekly expenses (one row per driverType+weekKey)
  for (const row of expRes.data ?? []) {
    const expenses: WeeklyExpenses = {
      weekKey: row.week_key,
      truckPayment: Number(row.truck_payment),
      truckPaymentFrequency: row.truck_payment_frequency,
      truckInsurance: Number(row.truck_insurance),
      trailerInsurance: Number(row.trailer_insurance),
      trailerLease: Number(row.trailer_lease),
      iftaCost: Number(row.ifta_cost),
      adminFee: Number(row.admin_fee),
      other: Number(row.other),
      startOdometer: Number(row.start_odometer),
      endOdometer: Number(row.end_odometer),
    };
    await AsyncStorage.setItem(
      `expenses:${row.driver_type}:${row.week_key}`,
      JSON.stringify(expenses)
    );
  }

  // Profiles (one row per driverType)
  for (const row of profRes.data ?? []) {
    await AsyncStorage.setItem(`profile:${row.driver_type}:name`, row.name);
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/storage/storage.ts
git commit -m "feat(storage): add pullFromSupabase and wipeAll helpers"
```

---

## Task 11: Migration module — Path A & Path B (TDD)

**Files:**
- Create: `__tests__/migration.test.ts`
- Create: `src/sync/migration.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/migration.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYNC_MIGRATED_KEY } from '../src/sync/types';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

const upsertMock = jest.fn(() => Promise.resolve({ error: null }));
const selectChain = (data: any[]) => ({
  select: () => ({ eq: () => Promise.resolve({ data, error: null }) }),
});

jest.mock('../src/supabase/client', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })) },
    from: jest.fn(),
  },
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  upsertMock.mockClear();
});

test('Path A: local data uploads on first login, then migrated flag is set', async () => {
  await AsyncStorage.setItem('loads:owner-op:2026-05-25', JSON.stringify([{
    id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
    startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
  }]));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({
    upsert: upsertMock,
    ...selectChain([]),
  }));

  const { runMigrationAndPull } = require('../src/sync/migration');
  await runMigrationAndPull('user-1');

  expect(upsertMock).toHaveBeenCalled();
  expect(await AsyncStorage.getItem(SYNC_MIGRATED_KEY)).toBe('true');
});

test('Path B: fresh device pulls Supabase data into AsyncStorage', async () => {
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation((table: string) => {
    if (table === 'loads') {
      return selectChain([{
        id: 'load-remote', user_id: 'user-1', week_key: '2026-05-25',
        driver_type: 'owner-op', start_location: 'X', end_location: 'Y',
        earnings: 200, created_at: '2026-05-25T10:00:00Z',
      }]);
    }
    return selectChain([]);
  });

  const { runMigrationAndPull } = require('../src/sync/migration');
  await runMigrationAndPull('user-1');

  const raw = await AsyncStorage.getItem('loads:owner-op:2026-05-25');
  const loads = JSON.parse(raw!);
  expect(loads).toHaveLength(1);
  expect(loads[0].id).toBe('load-remote');
  expect(await AsyncStorage.getItem(SYNC_MIGRATED_KEY)).toBe('true');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest __tests__/migration.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the migration module**

Create `src/sync/migration.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncEngine } from './syncEngine';
import { pullFromSupabase } from '../storage/storage';
import { SYNC_MIGRATED_KEY } from './types';
import type { LoadEntry, FuelEntry, WeeklyExpenses } from '../types';

async function hasLocalData(): Promise<boolean> {
  const all = await AsyncStorage.getAllKeys();
  return all.some((k) =>
    k.startsWith('loads:') ||
    k.startsWith('expenses:') ||
    k.startsWith('fuel:') ||
    k.startsWith('profile:')
  );
}

async function enqueueAllLocal(): Promise<void> {
  const all = await AsyncStorage.getAllKeys();

  for (const k of all) {
    if (k.startsWith('loads:')) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const loads: LoadEntry[] = JSON.parse(raw);
      for (const load of loads) {
        await syncEngine.enqueue({ kind: 'upsertLoad', payload: load });
      }
    } else if (k.startsWith('fuel:')) {
      const [, driverType] = k.split(':');
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const entries: FuelEntry[] = JSON.parse(raw);
      for (const entry of entries) {
        await syncEngine.enqueue({
          kind: 'upsertFuel',
          payload: { ...entry, driverType },
        });
      }
    } else if (k.startsWith('expenses:')) {
      const [, driverType] = k.split(':');
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const expenses: WeeklyExpenses = JSON.parse(raw);
      await syncEngine.enqueue({
        kind: 'upsertExpenses',
        payload: { ...expenses, driverType },
      });
    } else if (k.startsWith('profile:')) {
      const [, driverType] = k.split(':');
      const name = await AsyncStorage.getItem(k);
      if (name == null) continue;
      await syncEngine.enqueue({
        kind: 'upsertProfile',
        payload: { driverType, name },
      });
    }
  }
}

export async function runMigrationAndPull(userId: string): Promise<void> {
  const migrated = (await AsyncStorage.getItem(SYNC_MIGRATED_KEY)) === 'true';

  // Path A: local data + not yet migrated -> upload first
  if (!migrated && (await hasLocalData())) {
    await enqueueAllLocal();
    await syncEngine.flush();
  }

  // Path B: always pull after (covers fresh device AND merges with other-device data)
  await pullFromSupabase(userId);
  await AsyncStorage.setItem(SYNC_MIGRATED_KEY, 'true');
}
```

- [ ] **Step 4: Run the tests**

```bash
npx jest __tests__/migration.test.ts
```

Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add __tests__/migration.test.ts src/sync/migration.ts
git commit -m "feat(sync): migration uploads local then pulls supabase on login"
```

---

## Task 12: AuthScreen — phone entry stage

**Files:**
- Create: `src/screens/AuthScreen.tsx`

- [ ] **Step 1: Create the screen with phone stage only**

Create `src/screens/AuthScreen.tsx`:

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, StatusBar, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabase/client';
import { C } from '../theme';

type Stage = 'phone' | 'otp';

function normalizePhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\s|-/g, '');
  const digits = trimmed.replace(/\D/g, '');
  return `+1${digits}`;
}

export function AuthScreen() {
  const [stage, setStage] = useState<Stage>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [normalizedPhone, setNormalizedPhone] = useState('');

  async function handleSendCode() {
    const p = normalizePhone(phone);
    if (!/^\+\d{10,15}$/.test(p)) {
      Alert.alert('Invalid phone', 'Enter a valid phone number with country code.');
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: p });
    setSending(false);
    if (error) {
      Alert.alert('Could not send code', error.message);
      return;
    }
    setNormalizedPhone(p);
    setStage('otp');
  }

  async function handleVerify() {
    if (!/^\d{6}$/.test(otp)) {
      Alert.alert('Invalid code', 'Enter the 6-digit code from your text message.');
      return;
    }
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: otp,
      type: 'sms',
    });
    setVerifying(false);
    if (error) {
      Alert.alert('Verification failed', error.message);
      return;
    }
    // Session is now set; App.tsx auth listener will switch us to AppNavigator.
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={[C.gradStart, C.gradEnd]} style={s.header}>
        <SafeAreaView>
          <View style={s.headerInner}>
            <Ionicons name="lock-closed-outline" size={28} color="#fff" />
            <Text style={s.headerTitle}>TruckersPro</Text>
            <Text style={s.headerSub}>
              {stage === 'phone' ? 'Sign in with your phone' : 'Enter the code we sent'}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={s.form}>
          {stage === 'phone' ? (
            <>
              <Text style={s.label}>PHONE NUMBER</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 555 123 4567"
                placeholderTextColor={C.muted}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <TouchableOpacity
                onPress={handleSendCode}
                activeOpacity={0.85}
                disabled={sending}
              >
                <LinearGradient colors={[C.gradEnd, '#1D4ED8']} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>
                    {sending ? 'Sending…' : 'Send Code'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={s.label}>6-DIGIT CODE</Text>
              <TextInput
                style={s.input}
                value={otp}
                onChangeText={setOtp}
                placeholder="123456"
                placeholderTextColor={C.muted}
                keyboardType="number-pad"
                maxLength={6}
              />
              <TouchableOpacity
                onPress={handleVerify}
                activeOpacity={0.85}
                disabled={verifying}
              >
                <LinearGradient colors={[C.gradEnd, '#1D4ED8']} style={s.primaryBtn}>
                  <Text style={s.primaryBtnText}>
                    {verifying ? 'Verifying…' : 'Verify'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStage('phone')} style={s.linkBtn}>
                <Text style={s.linkText}>Use a different number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 20, paddingBottom: 32 },
  headerInner: { paddingTop: 24, alignItems: 'center' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', marginTop: 8 },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  form: { padding: 24, gap: 12 },
  label: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginTop: 12 },
  input: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 12,
    padding: 14, backgroundColor: C.inputBg, fontSize: 18, color: C.text,
    marginBottom: 8,
  },
  primaryBtn: { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: C.gradEnd, fontSize: 14, fontWeight: '600' },
});
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/AuthScreen.tsx
git commit -m "feat(auth): add phone + OTP AuthScreen"
```

---

## Task 13: Auth gate in App.tsx + sync start

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Read the current App.tsx**

Open `App.tsx`. The current structure wraps `AppNavigator` in `WeekProvider`. We need to:

1. Track session state at the top level
2. Show `<AuthScreen />` when there's no session
3. Run migration + pull on successful login
4. Start the sync engine after auth

- [ ] **Step 2: Replace App.tsx with the auth-gated version**

Replace the contents of `App.tsx` with:

```tsx
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { WeekProvider } from './src/context/WeekContext';
import { AppNavigator } from './src/navigation';
import { AuthScreen } from './src/screens/AuthScreen';
import { supabase } from './src/supabase/client';
import { syncEngine } from './src/sync/syncEngine';
import { runMigrationAndPull } from './src/sync/migration';
import { C } from './src/theme';

type AuthState = 'loading' | 'signed-out' | 'migrating' | 'ready' | 'error';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [error, setError] = useState<string | null>(null);

  async function bootstrap(userId: string) {
    try {
      setAuthState('migrating');
      await runMigrationAndPull(userId);
      syncEngine.start();
      setAuthState('ready');
    } catch (e: any) {
      setError(e?.message ?? 'Sync failed');
      setAuthState('error');
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        bootstrap(data.session.user.id);
      } else {
        setAuthState('signed-out');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        syncEngine.stop();
        setAuthState('signed-out');
      } else if (event === 'SIGNED_IN' && session?.user) {
        bootstrap(session.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (authState === 'loading' || authState === 'migrating') {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.gradEnd} />
        <Text style={s.loadingText}>
          {authState === 'migrating' ? 'Loading your data…' : ''}
        </Text>
      </View>
    );
  }

  if (authState === 'error') {
    return (
      <View style={s.center}>
        <Text style={s.errorTitle}>Couldn't load your data</Text>
        <Text style={s.errorBody}>{error}</Text>
        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => {
            setError(null);
            supabase.auth.getSession().then(({ data }) => {
              if (data.session?.user) bootstrap(data.session.user.id);
              else setAuthState('signed-out');
            });
          }}
        >
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (authState === 'signed-out') {
    return <AuthScreen />;
  }

  return (
    <WeekProvider>
      <AppNavigator />
    </WeekProvider>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.sub, fontWeight: '600' },
  errorTitle: { fontSize: 18, fontWeight: '800', color: C.danger, marginBottom: 8 },
  errorBody: { fontSize: 14, color: C.sub, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: C.gradEnd, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat(auth): gate app behind AuthScreen + run migration/pull on login"
```

---

## Task 14: Sign-out button on HomeScreen

**Files:**
- Modify: `src/screens/HomeScreen.tsx`

- [ ] **Step 1: Add the sign-out handler**

Open `src/screens/HomeScreen.tsx`. Add these imports near the top (alongside existing imports):

```ts
import { supabase } from '../supabase/client';
import { syncEngine } from '../sync/syncEngine';
import { wipeAll } from '../storage/storage';
import { Alert } from 'react-native';
```

Inside the `HomeScreen` component function, add this handler (before the `return`):

```ts
async function handleSignOut() {
  Alert.alert('Sign out', 'Sign out of your account?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      onPress: async () => {
        syncEngine.stop();
        await supabase.auth.signOut();
        await wipeAll();
      },
    },
  ]);
}
```

- [ ] **Step 2: Add the button to the header**

Find the gradient header `<LinearGradient ...>` block in `HomeScreen.tsx`. Inside the SafeAreaView, add a top-right sign-out icon. If there's an existing header row, append it; otherwise add this near the top of the SafeAreaView content:

```tsx
<TouchableOpacity
  onPress={handleSignOut}
  style={{ position: 'absolute', top: 12, right: 16, padding: 6 }}
  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
>
  <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.85)" />
</TouchableOpacity>
```

(If `TouchableOpacity` and `Ionicons` are not already imported in this file, add them.)

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/screens/HomeScreen.tsx
git commit -m "feat(auth): add sign-out button on HomeScreen"
```

---

## Task 15: Sync status badge component

**Files:**
- Create: `src/components/SyncStatusBadge.tsx`
- Modify: `src/screens/owner-op/OwnerOpDashboard.tsx`

- [ ] **Step 1: Create the badge component**

Create `src/components/SyncStatusBadge.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncEngine } from '../sync/syncEngine';
import { SYNC_QUEUE_KEY, QueuedOp } from '../sync/types';
import { C } from '../theme';

export function SyncStatusBadge() {
  const [queueSize, setQueueSize] = useState(0);
  const [headAttempts, setHeadAttempts] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function tick() {
      const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      const queue: QueuedOp[] = raw ? JSON.parse(raw) : [];
      if (!mounted) return;
      setQueueSize(queue.length);
      setHeadAttempts(queue[0]?.attempts ?? 0);
    }
    tick();
    const id = setInterval(tick, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  if (queueSize === 0) return null;

  const isError = headAttempts >= 3;

  return (
    <TouchableOpacity
      onPress={() => {
        if (isError) {
          Alert.alert(
            'Sync error',
            'We couldn\'t sync your latest changes. Tap retry to try again.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Retry', onPress: () => syncEngine.flush() },
            ]
          );
        } else {
          syncEngine.flush();
        }
      }}
      style={[s.pill, isError && s.pillError]}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Ionicons
        name={isError ? 'alert-circle-outline' : 'sync-outline'}
        size={12}
        color={isError ? '#fff' : 'rgba(255,255,255,0.9)'}
      />
      <Text style={s.text}>
        {isError ? 'Sync error' : `Syncing ${queueSize}`}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
  },
  pillError: { backgroundColor: C.danger },
  text: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
```

- [ ] **Step 2: Render the badge in OwnerOpDashboard header**

Open `src/screens/owner-op/OwnerOpDashboard.tsx`. Add the import:

```ts
import { SyncStatusBadge } from '../../components/SyncStatusBadge';
```

Inside the `<LinearGradient ...>` header block, find the row that contains the title/home button (the `headerTop` View). Add `<SyncStatusBadge />` as the last child of that row so it sits to the right of the home button. If layout is tight, place it just above the home button.

Example placement (inside `headerTop`):

```tsx
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
  <SyncStatusBadge />
  <TouchableOpacity onPress={() => navigation.goBack()} style={s.homeBtn}>
    <Ionicons name="home-outline" size={20} color="#fff" />
  </TouchableOpacity>
</View>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SyncStatusBadge.tsx src/screens/owner-op/OwnerOpDashboard.tsx
git commit -m "feat(sync): show syncing pill in dashboard header when queue is non-empty"
```

---

## Task 16: Run the full test suite

**Files:** none

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all tests pass, including the pre-existing `calculations.test.ts` failures we know about (note: those 3 tests were already failing before this work; they are unrelated to this plan).

- [ ] **Step 2: If anything new is broken, fix it**

If `storage.test.ts` or any test we wrote fails, debug and fix. Do not commit until the new tests we wrote all pass.

- [ ] **Step 3: Type-check entire project**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git status   # verify only intended files
git commit -m "fix: ensure all sync/auth tests pass after integration"
```

(Skip this commit if nothing needed fixing.)

---

## Task 17: Manual QA on device

**Files:** none

This task is **manual** — agent should pause and ask the user to verify.

- [ ] **Step 1: Start the dev server**

```bash
npx expo start
```

- [ ] **Step 2: Walk through the QA script**

Ask the user to test these flows on a real device with Expo Go:

1. **Fresh install** — delete the app on the device, scan QR, open. Should land on `AuthScreen`.
2. **Phone OTP** — enter your phone number, receive SMS, enter code. Should land on `HomeScreen`.
3. **Add a load** — go to Owner Operator → Add Load → save. Verify it appears on Dashboard.
4. **Verify Supabase sync** — open Supabase dashboard → Table Editor → `loads`. The new load row should appear within seconds with your `user_id`.
5. **Offline test** — turn on airplane mode → add another load → save. Should appear instantly on Dashboard. The "Syncing" pill should show in the header.
6. **Reconnect** — turn off airplane mode. The pill should disappear within ~30s, and the load should appear in Supabase.
7. **Sign out + sign back in** — tap the sign-out icon on Home → confirm. AuthScreen appears. Sign back in with the same phone. All loads should be there.
8. **Second device** (if available) — install Expo Go on another phone, sign in with the same number. Data should appear after the "Loading your data…" overlay.

- [ ] **Step 3: Document any issues**

If anything is broken, file follow-up tasks. Otherwise mark the plan complete.

---

## Out of Scope (deferred)

- Real-time Supabase subscriptions (live updates between devices)
- Account deletion UI
- Multi-account switching on one device
- E2E auth tests (require real Twilio infra)
