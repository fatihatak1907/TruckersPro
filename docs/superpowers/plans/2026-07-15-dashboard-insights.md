# Dashboard Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Owner-Op/Lease dashboard's Net Profit card and all six stat cards tappable, opening a bottom sheet with line-item breakdowns, percentages, per-mile numbers, and a vs-last-week comparison — making it obvious that diesel + DEF are included in total expenses.

**Architecture:** A pure `src/utils/insights.ts` module builds an `Insight` (title, headline, rows, footer, change) per card kind from this week's and last week's `(loads, expenses, fuelEntries)`. A reusable `<InsightsSheet />` renders it in a React Native `Modal`. `OwnerOpDashboard` fetches the previous week alongside the current one and wires taps. No new dependencies, no storage/sync/schema changes.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, Jest.

**Spec:** `docs/superpowers/specs/2026-07-15-dashboard-insights-design.md`

## Global Constraints

- No new npm dependencies. If a package were ever needed: `npm install <pkg> --legacy-peer-deps`.
- Owner-Op/Lease dashboard only; company dashboards untouched.
- Monthly→weekly conversion is `amount / 4.33`, identical to `calcOwnerOpSummary`.
- Mileage deduction rate is `$0.14/mi`.
- Never define React components inside another component's body (module scope only).
- Dark theme via `C.*` from `src/theme.ts`; currency formatting via `fmt` (`$1,234.56`).
- Run tests with `npx jest <file>`; type-check with `npx tsc --noEmit`.

---

### Task 1: `addWeeks` in weekKey.ts + shared `fmt` in utils

Move week arithmetic to `weekKey.ts` (WeekContext currently holds a private copy) and extract `fmt` out of a component file so pure utils/tests never import react-native.

**Files:**
- Modify: `src/utils/weekKey.ts`
- Create: `src/utils/format.ts`
- Modify: `src/context/WeekContext.tsx` (delete local `addWeeks`, import it)
- Modify: `src/components/SummaryCard.tsx:23-25` (re-export `fmt` from utils)
- Test: `__tests__/weekKey.test.ts` (append)

**Interfaces:**
- Produces: `addWeeks(weekKey: string, delta: number): string` from `src/utils/weekKey.ts`; `fmt(n: number): string` from `src/utils/format.ts`.

- [ ] **Step 1: Write the failing tests** — append to `__tests__/weekKey.test.ts`:

```ts
import { addWeeks } from '../src/utils/weekKey';

describe('addWeeks', () => {
  it('goes back one week', () => {
    expect(addWeeks('2026-07-13', -1)).toBe('2026-07-06');
  });
  it('goes forward one week across a month boundary', () => {
    expect(addWeeks('2026-06-29', 1)).toBe('2026-07-06');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/weekKey.test.ts`
Expected: FAIL — `addWeeks` is not exported.

- [ ] **Step 3: Implement** — append to `src/utils/weekKey.ts`:

```ts
export function addWeeks(weekKey: string, delta: number): string {
  const d = new Date(weekKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}
```

Create `src/utils/format.ts`:

```ts
export function fmt(n: number): string {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
```

In `src/context/WeekContext.tsx`: delete the local `addWeeks` function (lines 4–8) and add `import { addWeeks } from '../utils/weekKey';` next to the existing weekKey import.

In `src/components/SummaryCard.tsx`: delete the `fmt` function body (lines 23–25) and replace with:

```ts
export { fmt } from '../utils/format';
```

- [ ] **Step 4: Verify**

Run: `npx jest __tests__/weekKey.test.ts` → PASS
Run: `npx tsc --noEmit` → no errors
Run: `npm test` → only the 3 documented pre-existing `calculations.test.ts` failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/weekKey.ts src/utils/format.ts src/context/WeekContext.tsx src/components/SummaryCard.tsx __tests__/weekKey.test.ts
git commit -m "refactor: share addWeeks and fmt via utils"
```

---

### Task 2: insights.ts core — types, change comparison, Expenses breakdown

**Files:**
- Create: `src/utils/insights.ts`
- Test: `__tests__/insights.test.ts`

**Interfaces:**
- Consumes: `calcOwnerOpSummary(loads, expenses, fuelEntries)` from `src/utils/calculations.ts`; `fmt` from `src/utils/format.ts`; types `LoadEntry`, `WeeklyExpenses`, `FuelEntry` from `src/types`.
- Produces (used by Tasks 3–5):

```ts
export type InsightKind = 'net' | 'earnings' | 'expenses' | 'diesel' | 'def' | 'miles' | 'deduction';
export type InsightRow = { label: string; value: string; sub?: string };
export type WeekData = { loads: LoadEntry[]; expenses: WeeklyExpenses; fuelEntries: FuelEntry[] };
export type InsightChange = { delta: number; pct: number | null } | null;
export type Insight = { title: string; headline: string; rows: InsightRow[]; footer: InsightRow[]; change: InsightChange };
export function buildInsight(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null): Insight;
```

- [ ] **Step 1: Write the failing tests** — create `__tests__/insights.test.ts`:

```ts
import { buildInsight, WeekData } from '../src/utils/insights';
import type { WeeklyExpenses, LoadEntry, FuelEntry } from '../src/types';

function makeExpenses(over: Partial<WeeklyExpenses> = {}): WeeklyExpenses {
  return {
    weekKey: '2026-07-13',
    truckPayment: 0, truckPaymentFrequency: 'weekly',
    truckInsurance: 0, truckInsuranceFrequency: 'weekly',
    trailerInsurance: 0, trailerInsuranceFrequency: 'weekly',
    trailerLease: 0, trailerLeaseFrequency: 'weekly',
    iftaCost: 0, iftaCostFrequency: 'weekly',
    adminFee: 0, adminFeeFrequency: 'weekly',
    other: 0, otherFrequency: 'weekly',
    startOdometer: 0, endOdometer: 0,
    ...over,
  };
}

function makeLoad(over: Partial<LoadEntry> = {}): LoadEntry {
  return {
    id: 'l1', weekKey: '2026-07-13', driverType: 'owner-op',
    startLocation: 'Dallas', endLocation: 'Houston',
    createdAt: '2026-07-13T10:00:00Z', earnings: 1000, commissionRate: 0.1,
    ...over,
  };
}

function makeFuel(over: Partial<FuelEntry> = {}): FuelEntry {
  return { id: 'f1', weekKey: '2026-07-13', type: 'diesel', cost: 300, createdAt: '2026-07-13T12:00:00Z', ...over };
}

function week(over: Partial<WeekData> = {}): WeekData {
  return { loads: [], expenses: makeExpenses(), fuelEntries: [], ...over };
}

describe('expenses insight', () => {
  const thisWeek = week({
    loads: [makeLoad()],
    expenses: makeExpenses({ truckPayment: 433, truckPaymentFrequency: 'monthly', adminFee: 50, startOdometer: 1000, endOdometer: 2000 }),
    fuelEntries: [makeFuel({ type: 'diesel', cost: 300 }), makeFuel({ id: 'f2', type: 'def', cost: 40 })],
  });
  const insight = buildInsight('expenses', thisWeek, null);

  it('includes Diesel and DEF rows', () => {
    const labels = insight.rows.map((r) => r.label);
    expect(labels).toContain('Diesel');
    expect(labels).toContain('DEF');
  });

  it('headline equals fixed + commission + fuel', () => {
    // 433/4.33=100 truck, 50 admin, 100 commission, 300 diesel, 40 def = 590
    expect(insight.headline).toBe('$590.00');
  });

  it('weekly-izes monthly items and labels them', () => {
    const truck = insight.rows.find((r) => r.label === 'Truck payment')!;
    expect(truck.value).toBe('$100.00');
    expect(truck.sub).toContain('÷ 4.33');
  });

  it('shows % of total on rows', () => {
    const diesel = insight.rows.find((r) => r.label === 'Diesel')!;
    expect(diesel.sub).toContain('51%'); // 300/590
  });

  it('omits zero-amount lines', () => {
    expect(insight.rows.map((r) => r.label)).not.toContain('Trailer lease');
  });

  it('footer has % of earnings and cost per mile', () => {
    expect(insight.footer.find((r) => r.label === '% of earnings')!.value).toBe('59%'); // 590/1000
    expect(insight.footer.find((r) => r.label === 'Cost per mile')!.value).toBe('$0.59/mi'); // 590/1000mi
  });

  it('omits per-mile footer when miles is 0', () => {
    const noMiles = week({ loads: [makeLoad()], fuelEntries: [makeFuel()] });
    const i = buildInsight('expenses', noMiles, null);
    expect(i.footer.find((r) => r.label === 'Cost per mile')).toBeUndefined();
  });
});

describe('change vs last week', () => {
  it('is null when there is no last-week data', () => {
    expect(buildInsight('expenses', week({ fuelEntries: [makeFuel()] }), null).change).toBeNull();
    expect(buildInsight('expenses', week({ fuelEntries: [makeFuel()] }), week()).change).toBeNull();
  });

  it('computes delta and pct against last week', () => {
    const cur = week({ fuelEntries: [makeFuel({ cost: 300 })] });
    const prev = week({ fuelEntries: [makeFuel({ cost: 200 })] });
    const c = buildInsight('expenses', cur, prev).change!;
    expect(c.delta).toBeCloseTo(100);
    expect(c.pct).toBeCloseTo(50);
  });

  it('pct is null when last week metric was 0 but data existed', () => {
    const prev = week({ loads: [makeLoad({ earnings: 500, commissionRate: 0 })] }); // has data, 0 expenses
    const c = buildInsight('expenses', week({ fuelEntries: [makeFuel()] }), prev)!.change!;
    expect(c.pct).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/insights.test.ts`
Expected: FAIL — cannot find module `../src/utils/insights`.

- [ ] **Step 3: Implement** — create `src/utils/insights.ts`:

```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry, Frequency } from '../types';
import { calcOwnerOpSummary } from './calculations';
import { fmt } from './format';

export type InsightKind = 'net' | 'earnings' | 'expenses' | 'diesel' | 'def' | 'miles' | 'deduction';

export type InsightRow = { label: string; value: string; sub?: string };

export type WeekData = {
  loads: LoadEntry[];
  expenses: WeeklyExpenses;
  fuelEntries: FuelEntry[];
};

export type InsightChange = { delta: number; pct: number | null } | null;

export type Insight = {
  title: string;
  headline: string;
  rows: InsightRow[];
  footer: InsightRow[];
  change: InsightChange;
};

const TITLES: Record<InsightKind, string> = {
  net: 'Net Profit',
  earnings: 'Earnings',
  expenses: 'Total Expenses',
  diesel: 'Diesel',
  def: 'DEF',
  miles: 'Miles Driven',
  deduction: 'Mileage Deduction',
};

const toWeekly = (amount: number, freq: Frequency | undefined) =>
  freq === 'monthly' ? amount / 4.33 : amount;

function metric(kind: InsightKind, w: WeekData): number {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries);
  switch (kind) {
    case 'net': return s.netProfit;
    case 'earnings': return s.totalEarnings;
    case 'expenses': return s.totalExpenses;
    case 'diesel': return s.totalDiesel;
    case 'def': return s.totalDef;
    case 'miles': return s.milesDriven;
    case 'deduction': return s.mileageDeduction;
  }
}

function hasData(w: WeekData): boolean {
  const e = w.expenses;
  const anyExpense =
    e.truckPayment + e.truckInsurance + e.trailerInsurance + e.trailerLease +
    e.iftaCost + e.adminFee + (e.other ?? 0) > 0;
  const anyOdometer = e.endOdometer > e.startOdometer;
  return w.loads.length > 0 || w.fuelEntries.length > 0 || anyExpense || anyOdometer;
}

function computeChange(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null): InsightChange {
  if (!lastWeek || !hasData(lastWeek)) return null;
  const cur = metric(kind, thisWeek);
  const prev = metric(kind, lastWeek);
  return { delta: cur - prev, pct: prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null };
}

const miles = (w: WeekData) => w.expenses.endOdometer - w.expenses.startOdometer;

const fuelDate = (f: FuelEntry) =>
  new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function expenseRows(w: WeekData): InsightRow[] {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries);
  const e = w.expenses;
  const commission = w.loads.reduce((sum, l) => sum + (l.earnings ?? 0) * (l.commissionRate ?? 0), 0);

  const items: { label: string; weekly: number; freq: Frequency }[] = [
    { label: 'Truck payment', weekly: toWeekly(e.truckPayment, e.truckPaymentFrequency), freq: e.truckPaymentFrequency },
    { label: 'Truck insurance', weekly: toWeekly(e.truckInsurance, e.truckInsuranceFrequency), freq: e.truckInsuranceFrequency },
    { label: 'Trailer insurance', weekly: toWeekly(e.trailerInsurance, e.trailerInsuranceFrequency), freq: e.trailerInsuranceFrequency },
    { label: 'Trailer lease', weekly: toWeekly(e.trailerLease, e.trailerLeaseFrequency), freq: e.trailerLeaseFrequency },
    { label: 'IFTA', weekly: toWeekly(e.iftaCost, e.iftaCostFrequency), freq: e.iftaCostFrequency },
    { label: 'Admin fee', weekly: toWeekly(e.adminFee, e.adminFeeFrequency), freq: e.adminFeeFrequency },
    { label: 'Other', weekly: toWeekly(e.other ?? 0, e.otherFrequency), freq: e.otherFrequency },
    { label: 'Commission', weekly: commission, freq: 'weekly' },
    { label: 'Diesel', weekly: s.totalDiesel, freq: 'weekly' },
    { label: 'DEF', weekly: s.totalDef, freq: 'weekly' },
  ];

  return items
    .filter((i) => i.weekly > 0)
    .map((i) => {
      const pct = s.totalExpenses > 0 ? `${Math.round((i.weekly / s.totalExpenses) * 100)}% of expenses` : '';
      const monthly = i.freq === 'monthly' ? 'monthly ÷ 4.33' : '';
      const sub = [pct, monthly].filter(Boolean).join(' · ');
      return { label: i.label, value: fmt(i.weekly), ...(sub ? { sub } : {}) };
    });
}

export function buildInsight(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null): Insight {
  const s = calcOwnerOpSummary(thisWeek.loads, thisWeek.expenses, thisWeek.fuelEntries);
  const mi = miles(thisWeek);
  const change = computeChange(kind, thisWeek, lastWeek);
  let headline = fmt(metric(kind, thisWeek));
  let rows: InsightRow[] = [];
  const footer: InsightRow[] = [];

  switch (kind) {
    case 'expenses': {
      rows = expenseRows(thisWeek);
      if (s.totalEarnings > 0)
        footer.push({ label: '% of earnings', value: `${Math.round((s.totalExpenses / s.totalEarnings) * 100)}%` });
      if (mi > 0)
        footer.push({ label: 'Cost per mile', value: `${fmt(s.totalExpenses / mi)}/mi` });
      break;
    }
    // Task 3 adds: earnings, diesel, def, miles, deduction, net
    default:
      break;
  }

  return { title: TITLES[kind], headline, rows, footer, change };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest __tests__/insights.test.ts` → PASS
Run: `npx tsc --noEmit` → no errors

- [ ] **Step 5: Commit**

```bash
git add src/utils/insights.ts __tests__/insights.test.ts
git commit -m "feat: insights builder core with expenses breakdown"
```

---

### Task 3: insights.ts — earnings, diesel, def, miles, deduction, net

**Files:**
- Modify: `src/utils/insights.ts` (fill the switch)
- Test: `__tests__/insights.test.ts` (append)

**Interfaces:**
- Consumes/Produces: same `buildInsight` signature as Task 2 — only new `kind` branches.

- [ ] **Step 1: Write the failing tests** — append to `__tests__/insights.test.ts` (reuses the `week`/`makeLoad`/`makeExpenses`/`makeFuel` helpers defined at the top of the file):

```ts
describe('earnings insight', () => {
  const w = week({
    loads: [
      makeLoad({ id: 'a', earnings: 1000, tonu: 200 }),
      makeLoad({ id: 'b', startLocation: 'Austin', endLocation: 'El Paso', earnings: 800, tonu: 0 }),
    ],
    expenses: makeExpenses({ startOdometer: 0, endOdometer: 1000 }),
  });
  const i = buildInsight('earnings', w, null);

  it('has one row per load with route label', () => {
    expect(i.rows).toHaveLength(2);
    expect(i.rows[0].label).toBe('Dallas → Houston');
    expect(i.rows[0].value).toBe('$1,000.00');
  });

  it('shows TONU as sub only when > 0', () => {
    expect(i.rows[0].sub).toContain('$200.00');
    expect(i.rows[1].sub).toBeUndefined();
  });

  it('headline includes TONU and footer has earnings per mile', () => {
    expect(i.headline).toBe('$2,000.00');
    expect(i.footer.find((r) => r.label === 'Earnings per mile')!.value).toBe('$2.00/mi');
  });
});

describe('diesel insight', () => {
  const w = week({
    fuelEntries: [makeFuel({ cost: 300 }), makeFuel({ id: 'f2', cost: 150, createdAt: '2026-07-15T09:00:00Z' }), makeFuel({ id: 'f3', type: 'def', cost: 40 })],
    expenses: makeExpenses({ startOdometer: 0, endOdometer: 900 }),
  });
  const i = buildInsight('diesel', w, null);

  it('lists only diesel entries with dates', () => {
    expect(i.rows).toHaveLength(2);
    expect(i.rows[0].label).toBe('Jul 13');
    expect(i.rows[1].value).toBe('$150.00');
  });

  it('headline and per-mile footer', () => {
    expect(i.headline).toBe('$450.00');
    expect(i.footer.find((r) => r.label === 'Cost per mile')!.value).toBe('$0.50/mi');
  });
});

describe('miles + deduction insights', () => {
  const w = week({ expenses: makeExpenses({ startOdometer: 1000, endOdometer: 2500 }) });

  it('miles shows odometers and mi headline', () => {
    const i = buildInsight('miles', w, null);
    expect(i.headline).toBe('1,500 mi');
    expect(i.rows.map((r) => r.label)).toEqual(['Start odometer', 'End odometer', 'Miles driven']);
    expect(i.rows[2].value).toBe('1,500 mi');
  });

  it('deduction shows the formula', () => {
    const i = buildInsight('deduction', w, null);
    expect(i.headline).toBe('$210.00');
    expect(i.rows[0].label).toBe('1,500 mi × $0.14');
    expect(i.rows[0].value).toBe('$210.00');
  });
});

describe('net insight', () => {
  const w = week({
    loads: [makeLoad({ earnings: 2000, commissionRate: 0.1 })],
    fuelEntries: [makeFuel({ cost: 300 })],
    expenses: makeExpenses({ startOdometer: 0, endOdometer: 1000 }),
  });
  const i = buildInsight('net', w, null);

  it('shows the waterfall', () => {
    // earnings 2000; expenses = 200 commission + 300 diesel = 500; deduction 140; net 1360
    expect(i.rows.map((r) => r.label)).toEqual(['Earnings', 'Expenses', 'Mileage deduction', 'Net profit']);
    expect(i.rows[1].value).toBe('− $500.00');
    expect(i.rows[3].value).toBe('$1,360.00');
  });

  it('footer has profit margin', () => {
    expect(i.footer.find((r) => r.label === 'Profit margin')!.value).toBe('68%');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/insights.test.ts`
Expected: new describes FAIL (rows empty); Task 2 tests still PASS.

- [ ] **Step 3: Implement** — in `src/utils/insights.ts`, replace the `switch` in `buildInsight` (keeping the `expenses` case exactly as in Task 2) with:

```ts
  switch (kind) {
    case 'expenses': {
      rows = expenseRows(thisWeek);
      if (s.totalEarnings > 0)
        footer.push({ label: '% of earnings', value: `${Math.round((s.totalExpenses / s.totalEarnings) * 100)}%` });
      if (mi > 0)
        footer.push({ label: 'Cost per mile', value: `${fmt(s.totalExpenses / mi)}/mi` });
      break;
    }
    case 'earnings': {
      rows = thisWeek.loads.map((l) => ({
        label: `${l.startLocation} → ${l.endLocation}`,
        value: fmt(l.earnings ?? 0),
        ...((l.tonu ?? 0) > 0 ? { sub: `+ ${fmt(l.tonu ?? 0)} TONU` } : {}),
      }));
      if (mi > 0)
        footer.push({ label: 'Earnings per mile', value: `${fmt(s.totalEarnings / mi)}/mi` });
      break;
    }
    case 'diesel':
    case 'def': {
      const entries = thisWeek.fuelEntries.filter((f) => f.type === kind);
      rows = entries.map((f) => ({ label: fuelDate(f), value: fmt(f.cost) }));
      const total = kind === 'diesel' ? s.totalDiesel : s.totalDef;
      if (mi > 0 && total > 0)
        footer.push({ label: 'Cost per mile', value: `${fmt(total / mi)}/mi` });
      break;
    }
    case 'miles': {
      headline = `${mi.toLocaleString()} mi`;
      rows = [
        { label: 'Start odometer', value: thisWeek.expenses.startOdometer.toLocaleString() },
        { label: 'End odometer', value: thisWeek.expenses.endOdometer.toLocaleString() },
        { label: 'Miles driven', value: `${mi.toLocaleString()} mi` },
      ];
      break;
    }
    case 'deduction': {
      rows = [{ label: `${mi.toLocaleString()} mi × $0.14`, value: fmt(s.mileageDeduction) }];
      break;
    }
    case 'net': {
      rows = [
        { label: 'Earnings', value: fmt(s.totalEarnings) },
        { label: 'Expenses', value: `− ${fmt(s.totalExpenses)}` },
        { label: 'Mileage deduction', value: `− ${fmt(s.mileageDeduction)}` },
        { label: 'Net profit', value: fmt(s.netProfit) },
      ];
      if (s.totalEarnings > 0)
        footer.push({ label: 'Profit margin', value: `${Math.round((s.netProfit / s.totalEarnings) * 100)}%` });
      break;
    }
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest __tests__/insights.test.ts` → PASS (all describes)
Run: `npx tsc --noEmit` → no errors

- [ ] **Step 5: Commit**

```bash
git add src/utils/insights.ts __tests__/insights.test.ts
git commit -m "feat: insights for earnings, fuel, miles, deduction, net"
```

---

### Task 4: `<InsightsSheet />` component

RN `Modal` bottom sheet. No unit test (visual component; verified end-to-end in Task 5).

**Files:**
- Create: `src/components/InsightsSheet.tsx`

**Interfaces:**
- Consumes: `Insight`, `InsightChange` types from `src/utils/insights.ts`; `C` from `src/theme.ts`.
- Produces: `export function InsightsSheet(props: { insight: Insight | null; onClose: () => void })` — renders nothing when `insight` is null.

- [ ] **Step 1: Implement** — create `src/components/InsightsSheet.tsx`:

```tsx
import React from 'react';
import { Modal, View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';
import type { Insight, InsightChange } from '../utils/insights';

function ChangeChip({ change }: { change: InsightChange }) {
  if (change === null) {
    return <Text style={s.noData}>No data last week</Text>;
  }
  const up = change.delta >= 0;
  const color = up ? C.success : C.danger;
  const pctText = change.pct !== null ? ` (${Math.abs(change.pct).toFixed(0)}%)` : '';
  return (
    <View style={[s.chip, { borderColor: color }]}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={color} />
      <Text style={[s.chipText, { color }]}>
        {`$${Math.abs(change.delta).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${pctText} vs last week`}
      </Text>
    </View>
  );
}

type Props = { insight: Insight | null; onClose: () => void };

export function InsightsSheet({ insight, onClose }: Props) {
  return (
    <Modal visible={insight !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        {insight && (
          <>
            <Text style={s.title}>{insight.title}</Text>
            <Text style={s.headline}>{insight.headline}</Text>
            <ChangeChip change={insight.change} />
            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
              {insight.rows.length === 0 && (
                <Text style={s.empty}>Nothing recorded this week</Text>
              )}
              {insight.rows.map((r, idx) => (
                <View key={`${r.label}-${idx}`} style={s.row}>
                  <View style={s.rowLeft}>
                    <Text style={s.rowLabel}>{r.label}</Text>
                    {r.sub ? <Text style={s.rowSub}>{r.sub}</Text> : null}
                  </View>
                  <Text style={s.rowValue}>{r.value}</Text>
                </View>
              ))}
              {insight.footer.length > 0 && (
                <View style={s.footer}>
                  {insight.footer.map((r) => (
                    <View key={r.label} style={s.row}>
                      <Text style={s.rowSub}>{r.label}</Text>
                      <Text style={s.footerValue}>{r.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.closeText}>Close</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 32, maxHeight: '75%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.muted, marginBottom: 14 },
  title: { fontSize: 12, fontWeight: '700', color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase' },
  headline: { fontSize: 34, fontWeight: '900', color: C.text, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  noData: { fontSize: 12, color: C.muted, marginTop: 8 },
  scroll: { marginTop: 16 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.cardElevated,
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  rowSub: { fontSize: 12, color: C.sub, marginTop: 2 },
  rowValue: { fontSize: 14, fontWeight: '800', color: C.text },
  footer: { marginTop: 8 },
  footerValue: { fontSize: 13, fontWeight: '800', color: C.accent },
  empty: { fontSize: 13, color: C.muted, paddingVertical: 16, textAlign: 'center' },
  closeBtn: { marginTop: 16, backgroundColor: C.accent, borderRadius: 14, alignItems: 'center', paddingVertical: 12 },
  closeText: { color: C.accentText, fontSize: 15, fontWeight: '800' },
});
```

Note: check `src/theme.ts` for the exact neutral color names — if `C.muted` / `C.sub` / `C.cardElevated` don't exist under those names, substitute the theme's actual equivalents (they are used in `OwnerOpDashboard.tsx` today, so copy from there).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit` → no errors

- [ ] **Step 3: Commit**

```bash
git add src/components/InsightsSheet.tsx
git commit -m "feat: InsightsSheet bottom-sheet component"
```

---

### Task 5: Wire the dashboard

**Files:**
- Modify: `src/screens/owner-op/OwnerOpDashboard.tsx`

**Interfaces:**
- Consumes: `buildInsight`, `InsightKind`, `WeekData` from `src/utils/insights.ts`; `InsightsSheet` from `src/components/InsightsSheet.tsx`; `addWeeks` from `src/utils/weekKey.ts`.

- [ ] **Step 1: Implement.** In `src/screens/owner-op/OwnerOpDashboard.tsx`:

Add imports:

```tsx
import { addWeeks } from '../../utils/weekKey';
import { buildInsight, InsightKind, WeekData } from '../../utils/insights';
import { InsightsSheet } from '../../components/InsightsSheet';
```

Add state after the existing `useState` calls:

```tsx
const [openInsight, setOpenInsight] = useState<InsightKind | null>(null);
const [prevWeek, setPrevWeek] = useState<WeekData | null>(null);
```

Extend the `useFocusEffect` fetch (replace the existing `Promise.all` block):

```tsx
useFocusEffect(
  useCallback(() => {
    const prevKey = addWeeks(weekKey, -1);
    Promise.all([
      getLoadsForWeek(driverType, weekKey),
      getWeeklyExpenses(driverType, weekKey),
      getFuelEntriesForWeek(driverType, weekKey),
      getProfileName(),
      getLoadsForWeek(driverType, prevKey),
      getWeeklyExpenses(driverType, prevKey),
      getFuelEntriesForWeek(driverType, prevKey),
    ]).then(([l, e, f, name, pl, pe, pf]) => {
      setLoads(l);
      setExpenses(e ?? { ...EMPTY_EXPENSES, weekKey });
      setFuelEntries(f);
      setDriverName(name);
      setPrevWeek({
        loads: pl,
        expenses: pe ?? { ...EMPTY_EXPENSES, weekKey: prevKey },
        fuelEntries: pf,
      });
    });
  }, [weekKey])
);
```

Make the Net Profit card tappable (replace the `netCard` View):

```tsx
<TouchableOpacity style={s.netCard} onPress={() => setOpenInsight('net')} activeOpacity={0.8}>
  <Text style={s.netLabel}>NET PROFIT</Text>
  <Text style={[s.netValue, { color: summary.netProfit >= 0 ? C.success : C.danger }]}>
    {fmt(summary.netProfit)}
  </Text>
  <Text style={s.tapHint}>Tap for details</Text>
</TouchableOpacity>
```

Give the stat items kinds and make them tappable (replace the `statsGrid` block):

```tsx
<View style={s.statsGrid}>
  {([
    { label: 'Earnings', value: fmt(summary.totalEarnings), icon: 'trending-up', kind: 'earnings' },
    { label: 'Expenses', value: fmt(summary.totalExpenses), icon: 'trending-down', kind: 'expenses' },
    { label: 'Diesel', value: fmt(summary.totalDiesel), icon: 'water', kind: 'diesel' },
    { label: 'DEF', value: fmt(summary.totalDef), icon: 'water-outline', kind: 'def' },
    { label: 'Miles', value: `${summary.milesDriven.toLocaleString()} mi`, icon: 'speedometer-outline', kind: 'miles' },
    { label: 'Mi. Deduct', value: fmt(summary.mileageDeduction), icon: 'remove-circle-outline', kind: 'deduction' },
  ] as { label: string; value: string; icon: string; kind: InsightKind }[]).map((item) => (
    <TouchableOpacity key={item.label} style={s.statCard} onPress={() => setOpenInsight(item.kind)} activeOpacity={0.8}>
      <Ionicons name={item.icon as any} size={18} color={C.accent} style={s.statIcon} />
      <Text style={s.statValue}>{item.value}</Text>
      <Text style={s.statLabel}>{item.label}</Text>
      <Ionicons name="chevron-forward" size={12} color={C.muted} style={s.statChevron} />
    </TouchableOpacity>
  ))}
</View>
```

Render the sheet just before the closing `</View>` of the root (after the `</ScrollView>`):

```tsx
<InsightsSheet
  insight={
    openInsight
      ? buildInsight(openInsight, { loads, expenses, fuelEntries }, prevWeek)
      : null
  }
  onClose={() => setOpenInsight(null)}
/>
```

Add styles to the StyleSheet:

```tsx
tapHint: { fontSize: 11, color: C.muted, marginTop: 6, fontWeight: '600' },
statChevron: { position: 'absolute', top: 8, right: 8 },
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → no errors
Run: `npm test` → only the 3 documented pre-existing `calculations.test.ts` failures.

- [ ] **Step 3: End-to-end check** — with `npx expo start` running, open the app (Expo Go), then on the Dashboard:
- Tap Expenses → sheet lists fixed items, Commission, **Diesel**, **DEF** with % subs; footer shows % of earnings + cost/mile.
- Tap Net Profit → waterfall + margin.
- Tap Miles with no odometer set → "Nothing recorded" rows show 0s, no crash.
- With no data last week → "No data last week" instead of a chip.
- Backdrop tap and Close both dismiss.

- [ ] **Step 4: Commit**

```bash
git add src/screens/owner-op/OwnerOpDashboard.tsx
git commit -m "feat: tappable dashboard cards with insights bottom sheet"
```
