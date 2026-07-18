# Pre-Launch UX Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the nine pre-launch UX changes from `docs/superpowers/specs/2026-07-17-prelaunch-ux-batch-design.md`: signup email confirmation + name field, AddLoad commission reorder + city/state split, week-navigation clamps, fuel keyboard dismiss, one-time Other expenses, owner-op mileage removal, and lease custom mileage rate.

**Architecture:** All changes ride the existing three-layer model (screens → AsyncStorage → sync queue → Supabase). Data-model changes are additive (`'once'` frequency rides the existing `other_expenses` JSONB; `mileageRate` is a new optional field + one new `mileage_rate` column). Pure logic lives in `src/utils/`; screens only wire it up.

**Tech Stack:** Expo SDK 54 / React Native, TypeScript, Jest, Supabase JS v2.

## Global Constraints

- Default mileage rate is exactly `0.14` $/mi; a confirmed rate of 0/empty resets to `0.14` (a lease driver always has a rate).
- Conversion math: monthly ÷ `4.33`, daily × `7`, once = full amount in its week (same arithmetic as weekly).
- `'once'` UI labels: toggle/badge show `1x`; insights sub-label shows `one-time`.
- State list: exactly 56 entries — 50 states + DC + PR, GU, VI, AS, MP. Locations persist as the string `"City, ST"` (comma + space + 2-letter code).
- Week nav: minimum week = the week the app was opened in (`homeWeek`); maximum = `homeWeek + 1 week`. History tab stays fully visible/editable for past weeks.
- Owner-op (`driverType === 'owner-op'`): no odometer UI, no Miles / Mi. Deduct cards, deduction = 0 everywhere. Lease keeps everything + editable rate. Company modes untouched.
- Never define a React component inside another component's body (module scope only).
- Screens never await the network; all persistence via `src/storage/storage.ts`.
- After each task: `npx tsc --noEmit` clean and `npm test` fully green (70 tests pre-existing; count grows).
- Any `npm install` must pass `--legacy-peer-deps` (already forced by `.npmrc`).
- Work happens on branch `feat/prelaunch-ux-batch` off `master`.

---

### Task 1: Data model — `'once'` frequency + `mileageRate` + mileage opt-out in calculations

**Files:**
- Modify: `src/types/index.ts` (lines 27, 36-55)
- Modify: `src/utils/calculations.ts`
- Test: `__tests__/calculations.test.ts` (append new describe block)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `OtherFrequency = 'once' | 'daily' | 'weekly' | 'monthly'`; `WeeklyExpenses.mileageRate?: number`; `calcOwnerOpSummary(loads, rawExpenses, fuelEntries?, opts?: { mileage?: boolean })`; `normalizeExpenses` now always returns `mileageRate` (defaulted to `0.14`). All later tasks rely on these exact names.

- [ ] **Step 1: Write failing tests**

Append to `__tests__/calculations.test.ts`:

```ts
describe('once frequency + mileage options', () => {
  const base = {
    weekKey: '2026-07-13',
    truckPayment: 0, truckPaymentFrequency: 'weekly' as const,
    truckInsurance: 0, truckInsuranceFrequency: 'weekly' as const,
    trailerInsurance: 0, trailerInsuranceFrequency: 'weekly' as const,
    trailerLease: 0, trailerLeaseFrequency: 'weekly' as const,
    iftaCost: 0, iftaCostFrequency: 'weekly' as const,
    adminFee: 0, adminFeeFrequency: 'weekly' as const,
    other: 0, otherFrequency: 'weekly' as const,
    otherExpenses: [],
    startOdometer: 0, endOdometer: 0,
  };

  test('once expense counts fully in its week', () => {
    const s = calcOwnerOpSummary([], {
      ...base,
      otherExpenses: [{ id: 'x', label: 'Repair', amount: 300, frequency: 'once' as const }],
    });
    expect(s.totalExpenses).toBeCloseTo(300);
  });

  test('mileage: false zeroes miles and deduction', () => {
    const s = calcOwnerOpSummary([], { ...base, startOdometer: 1000, endOdometer: 2000 }, [], { mileage: false });
    expect(s.milesDriven).toBe(0);
    expect(s.mileageDeduction).toBe(0);
  });

  test('custom mileageRate is used', () => {
    const s = calcOwnerOpSummary([], { ...base, startOdometer: 0, endOdometer: 100, mileageRate: 0.2 });
    expect(s.mileageDeduction).toBeCloseTo(20);
  });

  test('default rate 0.14 when mileageRate absent', () => {
    const s = calcOwnerOpSummary([], { ...base, startOdometer: 0, endOdometer: 100 });
    expect(s.mileageDeduction).toBeCloseTo(14);
  });

  test('normalizeExpenses defaults mileageRate to 0.14', () => {
    expect(normalizeExpenses(base).mileageRate).toBe(0.14);
    expect(normalizeExpenses({ ...base, mileageRate: 0.2 }).mileageRate).toBe(0.2);
    expect(normalizeExpenses({ ...base, mileageRate: 0 }).mileageRate).toBe(0.14);
  });
});
```

(The file already imports `calcOwnerOpSummary` and `normalizeExpenses`; if `normalizeExpenses` is missing from the import, add it.)

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/calculations.test.ts`
Expected: FAIL — `'once'` not assignable / `mileageRate` unknown property / deduction assertions fail.

- [ ] **Step 3: Implement types**

In `src/types/index.ts`:

```ts
export type OtherFrequency = 'once' | 'daily' | 'weekly' | 'monthly';
```

and in `WeeklyExpenses`, after `endOdometer: number;` add:

```ts
  mileageRate?: number; // $/mi deduction rate; default 0.14 (lease drivers can customize)
```

- [ ] **Step 4: Implement calculations**

In `src/utils/calculations.ts`, `toWeekly` needs no change (`'once'` falls through to `amount`). Replace `normalizeExpenses` and the summary function's signature/mileage block:

```ts
export function normalizeExpenses(e: WeeklyExpenses): WeeklyExpenses {
  const otherExpenses = e.otherExpenses ?? [];
  const mileageRate = e.mileageRate && e.mileageRate > 0 ? e.mileageRate : 0.14;
  if ((e.other ?? 0) > 0 && otherExpenses.length === 0) {
    return {
      ...e,
      other: 0,
      otherFrequency: 'weekly',
      otherExpenses: [
        { id: 'legacy-other', label: 'Other', amount: e.other ?? 0, frequency: e.otherFrequency ?? 'weekly' },
      ],
      mileageRate,
    };
  }
  return { ...e, otherExpenses, mileageRate };
}

export function calcOwnerOpSummary(
  loads: LoadEntry[],
  rawExpenses: WeeklyExpenses,
  fuelEntries: FuelEntry[] = [],
  opts?: { mileage?: boolean }
): OwnerOpWeeklySummary {
```

and replace the two mileage lines inside:

```ts
  const mileageOn = opts?.mileage !== false;
  const milesDriven = mileageOn ? expenses.endOdometer - expenses.startOdometer : 0;
  const mileageDeduction = milesDriven * (expenses.mileageRate ?? 0.14);
```

- [ ] **Step 5: Verify green + typecheck**

Run: `npx jest __tests__/calculations.test.ts` → PASS. Run `npx tsc --noEmit` → clean. Run `npm test` → all green.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/utils/calculations.ts __tests__/calculations.test.ts
git commit -m "feat: once frequency, custom mileageRate, mileage opt-out in calc"
```

---

### Task 2: Insights — one-time sub-label, custom rate in deduction row, mileage flag

**Files:**
- Modify: `src/utils/insights.ts`
- Test: `__tests__/insights.test.ts` (append)

**Interfaces:**
- Consumes: Task 1's `calcOwnerOpSummary(..., opts)`, `normalizeExpenses` (returns `mileageRate`), `OtherFrequency` incl. `'once'`.
- Produces: `buildInsight(kind, thisWeek, lastWeek, opts?: { mileage?: boolean })` — Task 8 calls this with the 4th arg.

- [ ] **Step 1: Write failing tests**

Append to `__tests__/insights.test.ts` (reuse that file's existing empty-expenses helper if one exists; otherwise define `base` exactly as in Task 1 Step 1):

```ts
describe('prelaunch batch insights', () => {
  test('once expense shows one-time sub-label', () => {
    const i = buildInsight('expenses', {
      loads: [], fuelEntries: [],
      expenses: { ...base, otherExpenses: [{ id: 'x', label: 'Repair', amount: 300, frequency: 'once' as const }] },
    }, null);
    const row = i.rows.find((r) => r.label === 'Repair');
    expect(row?.sub).toContain('one-time');
  });

  test('deduction row shows custom rate', () => {
    const i = buildInsight('deduction', {
      loads: [], fuelEntries: [],
      expenses: { ...base, startOdometer: 0, endOdometer: 100, mileageRate: 0.2 },
    }, null);
    expect(i.rows[0].label).toBe('100 mi × $0.20');
    expect(i.headline).toBe('$20.00');
  });

  test('net waterfall omits deduction row when mileage off', () => {
    const i = buildInsight('net', {
      loads: [], fuelEntries: [],
      expenses: { ...base, startOdometer: 0, endOdometer: 100 },
    }, null, { mileage: false });
    expect(i.rows.some((r) => r.label === 'Mileage deduction')).toBe(false);
  });

  test('net waterfall keeps deduction row when mileage on', () => {
    const i = buildInsight('net', {
      loads: [], fuelEntries: [],
      expenses: { ...base, startOdometer: 0, endOdometer: 100 },
    }, null);
    expect(i.rows.some((r) => r.label === 'Mileage deduction')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/insights.test.ts` → FAIL (4th arg unknown, sub-label missing, rate hard-coded).

- [ ] **Step 3: Implement**

In `src/utils/insights.ts`:

1. Thread the flag. Change signatures:

```ts
type CalcOpts = { mileage?: boolean };

function metric(kind: InsightKind, w: WeekData, opts?: CalcOpts): number {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries, opts);
  // ...switch unchanged
}

function computeChange(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null, opts?: CalcOpts): InsightChange {
  if (!lastWeek || !hasData(lastWeek)) return null;
  const cur = metric(kind, thisWeek, opts);
  const prev = metric(kind, lastWeek, opts);
  return { delta: cur - prev, pct: prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null };
}

export function buildInsight(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null, opts?: CalcOpts): Insight {
  const s = calcOwnerOpSummary(thisWeek.loads, thisWeek.expenses, thisWeek.fuelEntries, opts);
  const mi = miles(thisWeek);
  const change = computeChange(kind, thisWeek, lastWeek, opts);
  let headline = fmt(metric(kind, thisWeek, opts));
  // ...
```

2. `freqNote` in `expenseRows` becomes:

```ts
      const freqNote =
        i.freq === 'monthly' ? 'monthly ÷ 4.33'
        : i.freq === 'daily' ? 'daily × 7'
        : i.freq === 'once' ? 'one-time'
        : '';
```

3. `deduction` case uses the real rate:

```ts
    case 'deduction': {
      const rate = normalizeExpenses(thisWeek.expenses).mileageRate ?? 0.14;
      rows = [{ label: `${s.milesDriven.toLocaleString()} mi × $${rate.toFixed(2)}`, value: fmt(s.mileageDeduction) }];
      break;
    }
```

4. `net` case conditionally includes the deduction row:

```ts
    case 'net': {
      rows = [
        { label: 'Earnings', value: fmt(s.totalEarnings) },
        { label: 'Expenses', value: `− ${fmt(s.totalExpenses)}` },
        ...(opts?.mileage === false
          ? []
          : [{ label: 'Mileage deduction', value: `− ${fmt(s.mileageDeduction)}` }]),
        { label: 'Net profit', value: fmt(s.netProfit) },
      ];
      // footer unchanged
```

- [ ] **Step 4: Verify green + typecheck**

`npx jest __tests__/insights.test.ts` → PASS; `npx tsc --noEmit` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/insights.ts __tests__/insights.test.ts
git commit -m "feat: insights honor once frequency, custom rate, mileage flag"
```

---

### Task 3: Sync + pull + schema-v4 for `mileage_rate`

**Files:**
- Modify: `src/sync/syncEngine.ts` (upsertExpenses payload, ~line 93-96)
- Modify: `src/storage/storage.ts` (pullFromSupabase expenses mapping, ~line 189-191)
- Create: `src/supabase/schema-v4.sql`
- Test: `__tests__/syncEngine.test.ts` (append)

**Interfaces:**
- Consumes: `WeeklyExpenses.mileageRate?: number` from Task 1.
- Produces: `weekly_expenses.mileage_rate` column contract (`numeric not null default 0.14`); upsert sends `mileage_rate`; pull maps `row.mileage_rate ?? 0.14` → `mileageRate`.

- [ ] **Step 1: Write failing test**

In `__tests__/syncEngine.test.ts`, find the existing test that asserts the `upsertExpenses` payload contains `other_expenses` and add alongside it (same mocking pattern as that test):

```ts
test('upsertExpenses payload includes mileage_rate (default 0.14)', async () => {
  // enqueue an upsertExpenses op whose payload has no mileageRate, flush,
  // then assert the captured supabase upsert argument:
  expect(capturedUpsert.mileage_rate).toBe(0.14);
});

test('upsertExpenses payload carries custom mileageRate', async () => {
  // same flow with payload.mileageRate = 0.2:
  expect(capturedUpsert.mileage_rate).toBe(0.2);
});
```

(Follow the file's existing capture mechanism — it already mocks `supabase.from(...).upsert` and inspects the argument for `other_expenses`. Mirror that exactly.)

- [ ] **Step 2: Run to verify failure**

`npx jest __tests__/syncEngine.test.ts` → FAIL (`mileage_rate` undefined).

- [ ] **Step 3: Implement**

`src/sync/syncEngine.ts`, in the `upsertExpenses` payload after `end_odometer: e.endOdometer,`:

```ts
        mileage_rate: e.mileageRate ?? 0.14,
```

`src/storage/storage.ts`, in `pullFromSupabase`'s expenses mapping after `endOdometer: Number(row.end_odometer),`:

```ts
      mileageRate: row.mileage_rate != null ? Number(row.mileage_rate) : 0.14,
```

Create `src/supabase/schema-v4.sql`:

```sql
-- schema-v4: per-week custom mileage deduction rate (lease drivers).
-- Additive and idempotent — safe to run on a live database.
alter table weekly_expenses
  add column if not exists mileage_rate numeric not null default 0.14;
```

- [ ] **Step 4: Verify green + typecheck**

`npx jest __tests__/syncEngine.test.ts` → PASS; `npx tsc --noEmit` clean; `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add src/sync/syncEngine.ts src/storage/storage.ts src/supabase/schema-v4.sql __tests__/syncEngine.test.ts
git commit -m "feat: sync + pull + schema-v4 for mileage_rate column"
```

---

### Task 4: Week navigation clamps

**Files:**
- Modify: `src/utils/weekKey.ts`
- Modify: `src/context/WeekContext.tsx`
- Modify: `src/screens/owner-op/OwnerOpDashboard.tsx` (week nav card, lines 112-120)
- Modify: `src/screens/company-mile/CompanyMileDashboard.tsx` (week nav card, lines 59-67)
- Modify: `src/screens/company-commission/CompanyCommissionDashboard.tsx` (week nav card, lines 59-67)
- Test: `__tests__/weekKey.test.ts` (append)

**Interfaces:**
- Consumes: existing `addWeeks`, `getCurrentWeekKey`.
- Produces: `clampWeek(candidate: string, homeWeek: string): string` in `weekKey.ts`; `useWeek()` now also returns `canGoPrev: boolean` and `canGoNext: boolean`.

- [ ] **Step 1: Write failing tests**

Append to `__tests__/weekKey.test.ts`:

```ts
import { clampWeek, addWeeks } from '../src/utils/weekKey'; // merge into existing import

describe('clampWeek', () => {
  const home = '2026-07-13';
  test('below home clamps to home', () => {
    expect(clampWeek('2026-07-06', home)).toBe(home);
  });
  test('home passes through', () => {
    expect(clampWeek(home, home)).toBe(home);
  });
  test('home+1 passes through', () => {
    expect(clampWeek('2026-07-20', home)).toBe('2026-07-20');
  });
  test('beyond home+1 clamps to home+1', () => {
    expect(clampWeek('2026-07-27', home)).toBe('2026-07-20');
  });
});
```

- [ ] **Step 2: Run to verify failure**

`npx jest __tests__/weekKey.test.ts` → FAIL (`clampWeek` not exported).

- [ ] **Step 3: Implement `clampWeek`**

Append to `src/utils/weekKey.ts` (ISO `YYYY-MM-DD` strings compare correctly lexically):

```ts
export function clampWeek(candidate: string, homeWeek: string): string {
  const max = addWeeks(homeWeek, 1);
  if (candidate < homeWeek) return homeWeek;
  if (candidate > max) return max;
  return candidate;
}
```

Verify: `npx jest __tests__/weekKey.test.ts` → PASS.

- [ ] **Step 4: Rewrite WeekContext**

Replace `src/context/WeekContext.tsx` content between the imports/`formatWeekDisplay` (unchanged) and `useWeek` (unchanged) with:

```tsx
import React, { createContext, useContext, useState } from 'react';
import { getCurrentWeekKey, addWeeks, clampWeek } from '../utils/weekKey';

// ...formatWeekDisplay unchanged...

type WeekContextType = {
  weekKey: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  goToPrev: () => void;
  goToNext: () => void;
};

const WeekContext = createContext<WeekContextType>({
  weekKey: getCurrentWeekKey(),
  canGoPrev: false,
  canGoNext: true,
  goToPrev: () => {},
  goToNext: () => {},
});

export function WeekProvider({ children }: { children: React.ReactNode }) {
  const [homeWeek] = useState(getCurrentWeekKey());
  const [weekKey, setWeekKey] = useState(homeWeek);
  return (
    <WeekContext.Provider
      value={{
        weekKey,
        canGoPrev: weekKey > homeWeek,
        canGoNext: weekKey < addWeeks(homeWeek, 1),
        goToPrev: () => setWeekKey((k) => clampWeek(addWeeks(k, -1), homeWeek)),
        goToNext: () => setWeekKey((k) => clampWeek(addWeeks(k, 1), homeWeek)),
      }}
    >
      {children}
    </WeekContext.Provider>
  );
}
```

- [ ] **Step 5: Dim disabled chevrons in all three dashboards**

Identical change in `OwnerOpDashboard.tsx`, `CompanyMileDashboard.tsx`, `CompanyCommissionDashboard.tsx`. Destructure the new booleans:

```tsx
  const { weekKey, goToPrev, goToNext, canGoPrev, canGoNext } = useWeek();
```

and change the week nav card to:

```tsx
        <View style={s.weekNavCard}>
          <TouchableOpacity onPress={goToPrev} disabled={!canGoPrev} style={[s.navBtn, !canGoPrev && s.navBtnDisabled]}>
            <Ionicons name="chevron-back" size={20} color={C.sub} />
          </TouchableOpacity>
          <Text style={s.weekLabel}>{formatWeekDisplay(weekKey)}</Text>
          <TouchableOpacity onPress={goToNext} disabled={!canGoNext} style={[s.navBtn, !canGoNext && s.navBtnDisabled]}>
            <Ionicons name="chevron-forward" size={20} color={C.sub} />
          </TouchableOpacity>
        </View>
```

and add to each file's StyleSheet next to `navBtn`:

```tsx
  navBtnDisabled: { opacity: 0.3 },
```

- [ ] **Step 6: Verify + commit**

`npx tsc --noEmit` clean; `npm test` green.

```bash
git add src/utils/weekKey.ts src/context/WeekContext.tsx src/screens/owner-op/OwnerOpDashboard.tsx src/screens/company-mile/CompanyMileDashboard.tsx src/screens/company-commission/CompanyCommissionDashboard.tsx __tests__/weekKey.test.ts
git commit -m "feat: clamp week navigation to home week .. home+1"
```

---

### Task 5: Fuel screen — dismiss keyboard on Add

**Files:**
- Modify: `src/screens/owner-op/OwnerOpFuel.tsx`

**Interfaces:** none (self-contained; one handler covers both Diesel and DEF via the `fuelType` state).

- [ ] **Step 1: Implement**

Add `Keyboard` to the `react-native` import (line 2-6):

```tsx
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, Keyboard,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
```

First line inside `handleAdd()`:

```tsx
  async function handleAdd() {
    Keyboard.dismiss();
    const c = parseFloat(cost);
    // ...unchanged
```

- [ ] **Step 2: Verify + commit**

`npx tsc --noEmit` clean; `npm test` green (no behavior tests apply — RN screen).

```bash
git add src/screens/owner-op/OwnerOpFuel.tsx
git commit -m "fix: dismiss number pad after adding a fuel entry"
```

---

### Task 6: US states module + StatePicker + AddLoad reorder & city/state split

**Files:**
- Create: `src/utils/usStates.ts`
- Create: `src/components/StatePicker.tsx`
- Modify: `src/screens/owner-op/OwnerOpAddLoad.tsx`
- Test: `__tests__/usStates.test.ts` (new)

**Interfaces:**
- Consumes: nothing from other tasks (parallel-safe).
- Produces: `US_STATES: { code: string; name: string }[]` (56 entries), `splitCityState(location: string): { city: string; state: string | null }`, `joinCityState(city: string, state: string): string`, `<StatePicker label value onSelect />`.

- [ ] **Step 1: Write failing tests**

Create `__tests__/usStates.test.ts`:

```ts
import { US_STATES, splitCityState, joinCityState } from '../src/utils/usStates';

describe('US_STATES', () => {
  test('has exactly 56 entries (50 states + DC + 5 territories)', () => {
    expect(US_STATES).toHaveLength(56);
  });
  test('codes are unique 2-letter uppercase', () => {
    const codes = US_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(56);
    codes.forEach((c) => expect(c).toMatch(/^[A-Z]{2}$/));
  });
  test('includes DC and the five territories', () => {
    for (const c of ['DC', 'PR', 'GU', 'VI', 'AS', 'MP']) {
      expect(US_STATES.some((s) => s.code === c)).toBe(true);
    }
  });
});

describe('splitCityState', () => {
  test('City, ST splits', () => {
    expect(splitCityState('Dallas, TX')).toEqual({ city: 'Dallas', state: 'TX' });
  });
  test('territory splits', () => {
    expect(splitCityState('San Juan, PR')).toEqual({ city: 'San Juan', state: 'PR' });
  });
  test('city with internal comma keeps head as city', () => {
    expect(splitCityState('Winston, Salem, NC')).toEqual({ city: 'Winston, Salem', state: 'NC' });
  });
  test('bare code goes to city (state unselected)', () => {
    expect(splitCityState('TX')).toEqual({ city: 'TX', state: null });
  });
  test('unknown tail goes wholly to city', () => {
    expect(splitCityState('Dallas, Texas')).toEqual({ city: 'Dallas, Texas', state: null });
  });
});

describe('joinCityState', () => {
  test('joins with comma-space', () => {
    expect(joinCityState(' Dallas ', 'TX')).toBe('Dallas, TX');
  });
});
```

- [ ] **Step 2: Run to verify failure**

`npx jest __tests__/usStates.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement `src/utils/usStates.ts`**

```ts
export type USState = { code: string; name: string };

export const US_STATES: USState[] = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' }, { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' }, { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' }, { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' }, { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' }, { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' }, { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' }, { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' }, { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'PR', name: 'Puerto Rico' }, { code: 'GU', name: 'Guam' },
  { code: 'VI', name: 'U.S. Virgin Islands' },
  { code: 'AS', name: 'American Samoa' },
  { code: 'MP', name: 'Northern Mariana Islands' },
];

const CODES = new Set(US_STATES.map((s) => s.code));

/** Parse a stored "City, ST" string. If the tail after the last ", " is not a
 *  known state code, the whole string lands in city (state stays unselected). */
export function splitCityState(location: string): { city: string; state: string | null } {
  const idx = location.lastIndexOf(', ');
  if (idx !== -1) {
    const tail = location.slice(idx + 2).trim().toUpperCase();
    if (CODES.has(tail)) return { city: location.slice(0, idx).trim(), state: tail };
  }
  return { city: location.trim(), state: null };
}

export function joinCityState(city: string, state: string): string {
  return `${city.trim()}, ${state}`;
}
```

Verify: `npx jest __tests__/usStates.test.ts` → PASS.

- [ ] **Step 4: Implement `src/components/StatePicker.tsx`**

```tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { US_STATES } from '../utils/usStates';
import { C } from '../theme';

type Props = {
  label: string;                      // placeholder when nothing selected, e.g. "Select state"
  value: string | null;               // 2-letter code or null
  onSelect: (code: string) => void;
};

export function StatePicker({ label, value, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const selected = US_STATES.find((st) => st.code === value);

  return (
    <>
      <TouchableOpacity style={s.btn} onPress={() => setOpen(true)} activeOpacity={0.8}>
        <Text style={[s.btnText, !selected && s.btnPlaceholder]} numberOfLines={1}>
          {selected ? `${selected.name} (${selected.code})` : label}
        </Text>
        <Ionicons name="chevron-down" size={16} color={C.sub} />
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Select state</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={C.sub} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={US_STATES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.row, item.code === value && s.rowActive]}
                  onPress={() => { onSelect(item.code); setOpen(false); }}
                >
                  <Text style={[s.rowText, item.code === value && s.rowTextActive]}>
                    {item.name} ({item.code})
                  </Text>
                  {item.code === value && <Ionicons name="checkmark" size={18} color={C.accent} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
  },
  btnText: { fontSize: 16, color: C.text, flex: 1 },
  btnPlaceholder: { color: C.muted },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '75%', paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 20,
  },
  rowActive: { backgroundColor: C.card },
  rowText: { fontSize: 15, color: C.text },
  rowTextActive: { fontWeight: '800', color: C.accent },
});
```

- [ ] **Step 5: Rework `OwnerOpAddLoad.tsx`**

Imports: add

```tsx
import { StatePicker } from '../../components/StatePicker';
import { splitCityState, joinCityState } from '../../utils/usStates';
```

Replace the two location states with four:

```tsx
  const [startCity, setStartCity] = useState('');
  const [startState, setStartState] = useState<string | null>(null);
  const [endCity, setEndCity] = useState('');
  const [endState, setEndState] = useState<string | null>(null);
```

Replace the location parts of the focus effect:

```tsx
      if (editLoad) {
        const start = splitCityState(editLoad.startLocation);
        const end = splitCityState(editLoad.endLocation);
        setStartCity(start.city);
        setStartState(start.state);
        setEndCity(end.city);
        setEndState(end.state);
        setEarnings(editLoad.earnings ?? 0);
        setTonu(editLoad.tonu ?? 0);
        setCommissionRate(editLoad.commissionRate ?? null);
      } else {
        setStartCity(''); setStartState(null);
        setEndCity(''); setEndState(null);
        setEarnings(0);
        setTonu(0);
        setCommissionRate(null);
      }
```

Validation + save in `handleSave`:

```tsx
    if (!startCity.trim() || !startState || !endCity.trim() || !endState) {
      Alert.alert('Missing fields', 'Please enter city and select a state for both start and end.');
      return;
    }
```

and in the `load` object:

```tsx
      startLocation: joinCityState(startCity, startState),
      endLocation: joinCityState(endCity, endState),
```

Form JSX — replace the two location inputs and reorder so commission sits under EARNINGS (above TONU):

```tsx
          <Text style={s.fieldLabel}>STARTING CITY</Text>
          <TextInput style={s.input} value={startCity} onChangeText={setStartCity} placeholder="e.g. Dallas" placeholderTextColor={C.muted} />
          <Text style={s.fieldLabel}>STARTING STATE</Text>
          <StatePicker label="Select state" value={startState} onSelect={setStartState} />

          <Text style={s.fieldLabel}>ENDING CITY</Text>
          <TextInput style={s.input} value={endCity} onChangeText={setEndCity} placeholder="e.g. Los Angeles" placeholderTextColor={C.muted} />
          <Text style={s.fieldLabel}>ENDING STATE</Text>
          <StatePicker label="Select state" value={endState} onSelect={setEndState} />

          <ConfirmedAmountField
            key={`earnings:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="EARNINGS ($)"
            amount={earnings}
            onCommit={(v) => setEarnings(v)}
            onDelete={() => setEarnings(0)}
          />

          <CommissionSelector
            label="COMMISSION FEE"
            options={[0, 0.10, 0.12, 0.15]}
            selected={commissionRate}
            onSelect={setCommissionRate}
          />

          {commissionAmount !== null && (
            <View style={s.calcBox}>
              <Ionicons name="calculator-outline" size={16} color={C.accent} />
              <Text style={s.calcText}>Commission: ${commissionAmount}</Text>
            </View>
          )}

          <ConfirmedAmountField
            key={`tonu:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="TONU ($)"
            amount={tonu}
            onCommit={(v) => setTonu(v)}
            onDelete={() => setTonu(0)}
          />
```

(Save button unchanged, after TONU.)

- [ ] **Step 6: Verify + commit**

`npx tsc --noEmit` clean; `npm test` green.

```bash
git add src/utils/usStates.ts src/components/StatePicker.tsx src/screens/owner-op/OwnerOpAddLoad.tsx __tests__/usStates.test.ts
git commit -m "feat: city + state picker in AddLoad, commission under earnings"
```

---

### Task 7: Expenses screen — 1x toggle, owner-op mileage removal, lease mileage rate

**Files:**
- Modify: `src/screens/owner-op/OwnerOpWeeklyExpenses.tsx`

**Interfaces:**
- Consumes: `OtherFrequency` incl. `'once'` and `WeeklyExpenses.mileageRate` (Task 1). Depends on Task 1 only.

- [ ] **Step 1: Implement**

1. `EMPTY` gains `mileageRate: 0.14,` after `startOdometer: 0, endOdometer: 0,`.

2. In `OtherExpenseEditor`, the `FreqToggle` becomes:

```tsx
        <FreqToggle
          value={freq}
          onChange={setFreq}
          options={['once', 'daily', 'weekly', 'monthly'] as const}
          labels={{ once: '1x', daily: 'D', weekly: 'W', monthly: 'M' }}
        />
```

3. Locked-row badge (in the `otherExpenses` map) becomes:

```tsx
                  <Text style={s.freqBadgeText}>
                    {o.frequency === 'monthly' ? 'M' : o.frequency === 'daily' ? 'D' : o.frequency === 'once' ? '1x' : 'W'}
                  </Text>
```

4. Component top: add the owner-op switch and a rate committer:

```tsx
  const isOwnerOp = driverType === 'owner-op';
```

```tsx
  function commitMileageRate(v: number) {
    persist({ ...exp, mileageRate: v > 0 ? v : 0.14 });
  }
```

5. Mileage math uses the custom rate:

```tsx
  const mileageDeduction = milesDriven * (exp.mileageRate ?? 0.14);
```

6. Wrap the entire MILEAGE (ODOMETER) section — the section title, both odometer fields, and the calcBox — in `{!isOwnerOp && (<>...</>)}`, and add the rate field after ENDING ODOMETER (inside the wrap, before the calcBox):

```tsx
          {!isOwnerOp && (
            <>
              <Text style={[s.sectionTitle, { marginTop: 16 }]}>MILEAGE (ODOMETER)</Text>
              <ConfirmedAmountField
                key={`startOdometer:${weekKey}`}
                label="STARTING ODOMETER"
                amount={exp.startOdometer}
                money={false}
                placeholder="e.g. 100000"
                onCommit={(v) => commitOdometer('startOdometer', v)}
                onDelete={() => commitOdometer('startOdometer', 0)}
              />
              <ConfirmedAmountField
                key={`endOdometer:${weekKey}`}
                label="ENDING ODOMETER"
                amount={exp.endOdometer}
                money={false}
                placeholder="e.g. 103500"
                onCommit={(v) => commitOdometer('endOdometer', v)}
                onDelete={() => commitOdometer('endOdometer', 0)}
              />
              <ConfirmedAmountField
                key={`mileageRate:${weekKey}`}
                label="MILEAGE RATE ($/MI)"
                amount={exp.mileageRate ?? 0.14}
                placeholder="0.14"
                onCommit={(v) => commitMileageRate(v)}
                onDelete={() => commitMileageRate(0.14)}
              />
              {milesDriven > 0 && (
                <View style={s.calcBox}>
                  <Ionicons name="speedometer-outline" size={16} color={C.accent} />
                  <View>
                    <Text style={s.calcText}>Miles driven: {milesDriven.toLocaleString()} mi</Text>
                    <Text style={s.calcText}>Mileage deduction: ${mileageDeduction.toFixed(2)}</Text>
                  </View>
                </View>
              )}
            </>
          )}
```

Note: the rate field renders locked at `$0.14` by default (amount > 0) with pencil/trash actions — trash resets to 0.14 via `onDelete`, and a committed 0/empty also resets to 0.14 via `commitMileageRate`. This is the spec's "a lease driver always has a rate".

- [ ] **Step 2: Verify + commit**

`npx tsc --noEmit` clean; `npm test` green.

```bash
git add src/screens/owner-op/OwnerOpWeeklyExpenses.tsx
git commit -m "feat: 1x expense option, lease mileage rate field, hide odometer for owner-op"
```

---

### Task 8: Dashboard + History — mileage flag wiring

**Files:**
- Modify: `src/screens/owner-op/OwnerOpDashboard.tsx`
- Modify: `src/screens/owner-op/OwnerOpHistory.tsx`

**Interfaces:**
- Consumes: `calcOwnerOpSummary(..., { mileage })` (Task 1), `buildInsight(..., { mileage })` (Task 2). Depends on Tasks 1, 2. Also touches `OwnerOpDashboard.tsx` — run after Task 4 (same file).

- [ ] **Step 1: Dashboard**

In `OwnerOpDashboard.tsx`:

```tsx
  const mileageOn = driverType !== 'owner-op';
  const summary = calcOwnerOpSummary(loads, expenses, fuelEntries, { mileage: mileageOn });
```

Replace the stats array so the two mileage cards only appear when `mileageOn`:

```tsx
          {([
            { label: 'Earnings', value: fmt(summary.totalEarnings), icon: 'trending-up', kind: 'earnings' },
            { label: 'Expenses', value: fmt(summary.totalExpenses), icon: 'trending-down', kind: 'expenses' },
            { label: 'Diesel', value: fmt(summary.totalDiesel), icon: 'water', kind: 'diesel' },
            { label: 'DEF', value: fmt(summary.totalDef), icon: 'water-outline', kind: 'def' },
            ...(mileageOn
              ? [
                  { label: 'Miles', value: `${summary.milesDriven.toLocaleString()} mi`, icon: 'speedometer-outline', kind: 'miles' },
                  { label: 'Mi. Deduct', value: fmt(summary.mileageDeduction), icon: 'remove-circle-outline', kind: 'deduction' },
                ]
              : []),
          ] as { label: string; value: string; icon: string; kind: InsightKind }[]).map((item) => (
```

And pass the flag to insights:

```tsx
        insight={
          openInsight
            ? buildInsight(openInsight, { loads, expenses, fuelEntries }, prevWeek, { mileage: mileageOn })
            : null
        }
```

- [ ] **Step 2: History**

In `OwnerOpHistory.tsx`:

```tsx
  const mileageOn = driverType !== 'owner-op';
```

(place right under the `driverType` line). In `loadWeekData`:

```tsx
    const summary = calcOwnerOpSummary(
      loads,
      expenses ?? { ...EMPTY_EXPENSES, weekKey },
      fuelEntries,
      { mileage: mileageOn }
    );
```

In the summary strip, render the Miles column (and its preceding divider) only when `mileageOn`:

```tsx
                  {mileageOn && (
                    <>
                      <View style={s.summaryDivider} />
                      <View style={s.summaryItem}>
                        <Text style={s.summaryLabel}>Miles</Text>
                        <Text style={s.summaryValue}>{weekData[wk].summary.milesDriven.toLocaleString()}</Text>
                      </View>
                    </>
                  )}
```

(The Earnings and Expenses items plus the first divider stay unconditional.)

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit` clean; `npm test` green.

```bash
git add src/screens/owner-op/OwnerOpDashboard.tsx src/screens/owner-op/OwnerOpHistory.tsx
git commit -m "feat: hide mileage cards/columns and zero deduction for owner-op"
```

---

### Task 9: Signup — name field, metadata, confirmation-pending state; App bootstrap metadata profile

**Files:**
- Modify: `src/screens/SignupScreen.tsx`
- Modify: `App.tsx` (bootstrap, lines 28-63)

**Interfaces:**
- Consumes: nothing from other tasks (parallel-safe).
- Produces: signup stores `{ driver_type, name }` in `auth.users.user_metadata`; App bootstrap creates the `profiles` row from that metadata on first confirmed login. Server-side email confirmation itself is toggled by the controller (see "Controller-only follow-ups").

- [ ] **Step 1: SignupScreen changes**

1. New state:

```tsx
  const [name, setName] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState(false);
```

2. In `handleCreate`, validate name first (before the email check):

```tsx
    if (!name.trim()) { setError('Enter your name or company name.'); return; }
```

3. Replace the `signUp` call and post-signup logic:

```tsx
    setSubmitting(true);
    const { data, error: signErr } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { data: { driver_type: driverType, name: name.trim() } },
    });
    if (signErr || !data.user) {
      setSubmitting(false);
      setError(
        signErr?.message?.includes('already')
          ? 'An account with this email already exists. Try signing in.'
          : signErr?.message ?? 'Sign up failed.'
      );
      return;
    }

    if (!data.session) {
      // Email confirmation is on — no session yet. The profiles row is created
      // by App bootstrap from user_metadata after the first confirmed login.
      setSubmitting(false);
      setPendingConfirm(true);
      return;
    }

    // Confirmation disabled — session exists, keep the immediate flow.
    const { error: profErr } = await supabase.from('profiles').insert({
      user_id: data.user.id,
      driver_type: driverType,
      name: name.trim(),
    });
    if (profErr) {
      setSubmitting(false);
      setError('Account created but profile setup failed. Please sign in.');
      return;
    }

    await saveDriverType(driverType);
    setSubmitting(false);
```

4. Name field in the form, above EMAIL:

```tsx
            <Text style={s.label}>YOUR NAME / COMPANY</Text>
            <View style={s.inputWrap}>
              <Ionicons name="person-outline" size={18} color={C.sub} />
              <TextInput style={s.input} value={name} onChangeText={setName}
                placeholder="e.g. Fatih Atak" placeholderTextColor={C.muted}
                autoCapitalize="words" autoComplete="name" autoCorrect={false} />
            </View>
```

5. Pending-confirmation success state — early return before the main `return`, reusing existing styles plus three new ones:

```tsx
  if (pendingConfirm) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <View style={s.confirmWrap}>
          <Ionicons name="mail-unread-outline" size={64} color={C.accent} />
          <Text style={s.appName}>Check your email</Text>
          <Text style={s.confirmBody}>
            We sent a confirmation link to {email.trim().toLowerCase()}. Tap the link, then come
            back and log in. Didn't get it? Check your spam folder.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Go to Log In</Text>
            <Ionicons name="arrow-forward" size={20} color={C.accentText} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }
```

New styles:

```tsx
  confirmWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  confirmBody: { fontSize: 14, color: C.sub, textAlign: 'center', lineHeight: 21 },
```

(`primaryBtn` has `marginTop: 16` already; add `alignSelf: 'stretch'` inline if it renders too narrow: `style={[s.primaryBtn, { alignSelf: 'stretch' }]}`.)

- [ ] **Step 2: App.tsx — create profile from metadata**

Add a module-level helper above `App()` is not possible (needs supabase import — it's already imported at module scope, so a plain async function above `export default function App()` is fine):

```tsx
async function createProfileFromMetadata(uid: string): Promise<{ driver_type: string; name: string } | null> {
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.user_metadata as { driver_type?: string; name?: string } | undefined;
  if (!meta?.driver_type) return null;
  const { error } = await supabase.from('profiles').insert({
    user_id: uid,
    driver_type: meta.driver_type,
    name: meta.name ?? '',
  });
  if (error) return null;
  return { driver_type: meta.driver_type, name: meta.name ?? '' };
}
```

In `bootstrap`, replace the missing-profile branch:

```tsx
      let profile = await fetchProfileWithRetry(uid);
      if (!profile) {
        profile = await createProfileFromMetadata(uid);
      }
      if (!profile) {
        setAuthState('needs-profile');
        return;
      }
```

(Everything after — `saveDriverType`, migration, sync start — unchanged. The pull inside `runMigrationAndPull` stores the profile name locally, so the Dashboard subtitle shows the signup name.)

- [ ] **Step 3: Verify + commit**

`npx tsc --noEmit` clean; `npm test` green.

```bash
git add src/screens/SignupScreen.tsx App.tsx
git commit -m "feat: signup name field, email-confirmation flow, metadata profile creation"
```

---

## Controller-only follow-ups (not subagent tasks)

1. **Supabase — enable email confirmations** (needs the user's new `sbp_` token):
   `PATCH https://api.supabase.com/v1/projects/wuegzljzxnacssxzxfsh/config/auth` with `{"mailer_autoconfirm": false}`; verify by GET read-back.
2. **Supabase — apply `src/supabase/schema-v4.sql`** via `POST .../database/query`; verify with `select column_name from information_schema.columns where table_name='weekly_expenses' and column_name='mileage_rate';`
3. Final whole-branch review → merge to `master` → preview APK + production `.aab`.

## Task ordering / parallel lanes

Dependencies: 1 → 2 → 3 is the data lane (2 and 3 both build on 1; 3 only needs 1). 7 needs 1. 8 needs 1, 2, and must follow 4 (both edit `OwnerOpDashboard.tsx`). 5, 6, 9 are independent of everything.

Safe parallel lanes (disjoint files):
- **Lane A (sequential):** 1 → 2 → 3 → 7 → 8
- **Lane B:** 4 (must complete before 8 starts)
- **Lane C:** 5
- **Lane D:** 6
- **Lane E:** 9

## Manual test checklist (preview APK, after merge)

- Signup: name required; with confirmation on → "Check your email" state; confirm link → log in → name under driver type on Dashboard.
- AddLoad: commission directly under earnings; city + state pickers; edit an old `"Dallas, TX"` load prefills both; old free-text load lands in city.
- Week nav: back chevron dimmed on home week; forward stops at +1; History still opens past weeks.
- Fuel: keyboard drops on Add (diesel and DEF).
- Other expense: 1x option; a one-time expense counts fully this week only.
- Owner-op: no odometer section, no Miles/Mi. Deduct cards, net = earnings − expenses.
- Lease: odometer + rate field default $0.14, custom rate changes deduction and insight row.
