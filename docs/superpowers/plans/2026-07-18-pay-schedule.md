# Pay Schedule (Configurable Working Periods + Pay Dates) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-18-pay-schedule-design.md` — this plan implements it exactly.

**Goal**

Replace the hard-coded Monday-week rhythm with a per-driver pay schedule (start date, payment frequency, pay day) for all four driver types (`owner-op`, `lease`, `company-mile`, `company-commission`). Additive data model: existing weekly users see zero change until they opt in. Weekly period keys stay byte-identical to today's week keys, so no stored-data migration.

**Architecture**

- New pure period engine `src/utils/payPeriods.ts` (weekly / biweekly / monthly periods + pay dates, all UTC), built on the existing `getWeekKey` so weekly boundaries cannot drift.
- `PaySchedule` stored locally at `profile:schedule` (JSON) and synced into three new `profiles` columns (schema-v6, additive). Sync flows through the existing `upsertProfile` op; `pullFromSupabase` maps the columns back.
- `WeekContext` becomes the period provider (same file, same `useWeek()` / `weekKey` names; `weekKey` now means "current period key"). It loads the schedule async and exposes `period`, `schedule`, `reloadSchedule`, clamped prev/next navigation.
- `calcOwnerOpSummary` gains `opts.period?: { days, isMonth }` with recurring-expense conversion `toPeriod`; default `{days: 7, isMonth: false}` is byte-identical to today. Insights thread the same option. Company summaries are load-sums — unchanged.
- UI: `PayScheduleForm` + `PayScheduleModal` (custom month-grid calendar, no new deps), inline collapsed section on Signup, one-time "Set your pay schedule" banner on dashboards for existing accounts, a shared `PeriodBar` (range + pay day + calendar icon) on all 4 dashboards, and period-aware History rows on all 3 History screens.

**Tech Stack**

Expo SDK 54 / React Native, TypeScript, AsyncStorage, custom sync queue → Supabase (Postgres + RLS), Jest. No new dependencies.

---

## Global Constraints (binding — every task must respect these)

- **Branch:** all work on `feat/pay-schedule` (create from `master` before Task 1: `git checkout -b feat/pay-schedule`).
- **Period key format:** `YYYY-MM-DD` of the period start. For weekly this is **byte-identical** to today's week keys produced by `getWeekKey` — existing stored data needs no migration.
- **`PaySchedule`** = `{ startDate: string /* YYYY-MM-DD, any date */, frequency: 'weekly' | 'biweekly' | 'monthly', payDay: number }`.
- **`payDay` semantics:** weekly/biweekly → weekday **1–7 (1 = Monday … 7 = Sunday)**; monthly → day of month **1–28 or 31 meaning "last day of month"**.
- **Default schedule** (existing users and anyone who skips setup): `{ startDate: getWeekKey(today), frequency: 'weekly', payDay: 5 /* Friday */ }`.
- **Period rules:**
  - weekly: Monday–Sunday, 7 days, boundaries identical to `getWeekKey`.
  - biweekly: 14 days, Monday–Sunday ×2, anchored to the **Monday of the week containing `schedule.startDate`**; dates before the anchor extend the lattice backward consistently (`Math.floor` of the day-diff / 14, which is negative-safe).
  - monthly: true calendar months, 1st → last day; Feb 28/29 and leap years via real Date math.
  - payDate: weekly/biweekly → the first `payDay` weekday **strictly AFTER** the period's end; monthly → `payDay` of the **FOLLOWING** month, clamped to that month's last day (31 ⇒ always last day).
- **All date math in UTC**, exactly the `weekKey.ts` convention: `new Date(key + 'T00:00:00Z')`, `setUTCDate` / `setUTCMonth` / `Date.UTC`, `toISOString().slice(0, 10)`. Never local-time `Date` parts.
- **`toPeriod(amount, freq, period)` formulas (verbatim from spec §5):**
  - `once` → amount
  - `daily` → amount × period.days
  - `weekly` → amount × (period.days / 7)
  - `monthly` → period.isMonth ? amount : amount × (period.days / 7) / 4.33
- **Back-compat:** every existing call site of `calcOwnerOpSummary` / `buildInsight` without `period` must behave **byte-identically** (default `{days: 7, isMonth: false}`). Existing tests stay green untouched.
- **schema-v6 SQL (verbatim, file `src/supabase/schema-v6.sql`):**
  ```sql
  alter table profiles add column if not exists schedule_start_date date;
  alter table profiles add column if not exists schedule_frequency text not null default 'weekly';
  alter table profiles add column if not exists schedule_pay_day int not null default 5;
  ```
- **After every task:** `npx tsc --noEmit` clean AND `npm test` fully green before committing.
- **Repo hard rule:** never define a React component inside another component's function body (module scope only).
- Storage local key: `profile:schedule` (JSON). Banner-dismissed key: `profile:schedule_banner_dismissed` (`'true'`). Both are covered by `wipeAll()`'s existing `profile:` prefix filter — do not change `wipeAll`.

---

## Task 1 — Period engine: `src/utils/payPeriods.ts` + schedule types

**Files**
- Modify: `c:\Claude\Truckerspro\src\types\index.ts` (append schedule types)
- Create: `c:\Claude\Truckerspro\src\utils\payPeriods.ts`
- Test: `c:\Claude\Truckerspro\__tests__\payPeriods.test.ts` (new)

**Interfaces**
- Consumes: `getWeekKey(date: Date): string` from `src/utils/weekKey.ts` (existing, unchanged).
- Produces (from `src/types/index.ts`):
  - `type PayFrequency = 'weekly' | 'biweekly' | 'monthly'`
  - `type PaySchedule = { startDate: string; frequency: PayFrequency; payDay: number }`
  - `type PayPeriod = { key: string; start: string; end: string; payDate: string }`
- Produces (from `src/utils/payPeriods.ts`):
  - `defaultSchedule(today?: Date): PaySchedule`
  - `periodForDate(date: string, schedule: PaySchedule): PayPeriod`
  - `getPeriod(key: string, schedule: PaySchedule): PayPeriod`
  - `addPeriods(key: string, delta: number, schedule: PaySchedule): string`
  - `firstPeriod(schedule: PaySchedule): PayPeriod`
  - `periodDays(period: PayPeriod): number`
  - `periodCalcOpts(period: PayPeriod, schedule: PaySchedule): { days: number; isMonth: boolean }`
  - `formatPeriodDisplay(period: PayPeriod): string` — e.g. `"Jul 13 – Jul 26"` (en dash `–`, same as `formatWeekDisplay`)
  - `formatPayDate(period: PayPeriod): string` — e.g. `"Fri, Jul 31"`

### Steps

- [ ] **1.1 Setup:** `git checkout -b feat/pay-schedule` (skip if the branch already exists).

- [ ] **1.2 Write the failing test file** `__tests__/payPeriods.test.ts` (complete file):

```ts
import { getWeekKey } from '../src/utils/weekKey';
import {
  defaultSchedule,
  periodForDate,
  getPeriod,
  addPeriods,
  firstPeriod,
  periodDays,
  periodCalcOpts,
  formatPeriodDisplay,
  formatPayDate,
} from '../src/utils/payPeriods';
import type { PaySchedule } from '../src/types';

// Weekday facts used below (all verifiable): 2026-01-01 = Thursday,
// 2026-07-13 = Monday, 2026-07-17 = Friday, 2028-01-01 = Saturday, 2028 is a leap year.

const weekly: PaySchedule = { startDate: '2026-07-13', frequency: 'weekly', payDay: 5 };
const biweekly: PaySchedule = { startDate: '2026-07-15', frequency: 'biweekly', payDay: 5 };
const monthly: PaySchedule = { startDate: '2026-07-01', frequency: 'monthly', payDay: 15 };

const addDaysIso = (key: string, n: number) => {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('defaultSchedule', () => {
  it('is weekly, payDay Friday, starting on the current week Monday', () => {
    const today = new Date('2026-07-17T12:00:00Z'); // Friday
    expect(defaultSchedule(today)).toEqual({
      startDate: '2026-07-13',
      frequency: 'weekly',
      payDay: 5,
    });
  });
});

describe('weekly periods', () => {
  it('produces keys byte-identical to getWeekKey across 200 consecutive dates', () => {
    for (let i = 0; i < 200; i++) {
      const iso = addDaysIso('2026-01-01', i);
      expect(periodForDate(iso, weekly).key).toBe(getWeekKey(new Date(iso + 'T00:00:00Z')));
    }
  });

  it('spans Monday–Sunday inclusive', () => {
    const p = periodForDate('2026-07-17', weekly);
    expect(p).toMatchObject({ key: '2026-07-13', start: '2026-07-13', end: '2026-07-19' });
    expect(periodDays(p)).toBe(7);
  });

  it('pay date is the first payDay weekday strictly after the end', () => {
    // end Sun 2026-07-19 → first Friday after = 2026-07-24
    expect(periodForDate('2026-07-13', weekly).payDate).toBe('2026-07-24');
  });

  it('payDay 1 (Monday) lands on the day right after a Sunday end', () => {
    const monPay: PaySchedule = { ...weekly, payDay: 1 };
    expect(periodForDate('2026-07-13', monPay).payDate).toBe('2026-07-20');
  });

  it('payDay 7 (Sunday) is strictly after the end, never the end itself', () => {
    const sunPay: PaySchedule = { ...weekly, payDay: 7 };
    // end Sun 2026-07-19 → NEXT Sunday 2026-07-26
    expect(periodForDate('2026-07-13', sunPay).payDate).toBe('2026-07-26');
  });

  it('crosses the Dec→Jan boundary', () => {
    // 2026-01-01 is a Thursday → week is 2025-12-29..2026-01-04; first Fri after = 2026-01-09
    const p = periodForDate('2026-01-01', weekly);
    expect(p).toMatchObject({ key: '2025-12-29', start: '2025-12-29', end: '2026-01-04' });
    expect(p.payDate).toBe('2026-01-09');
  });

  it('addPeriods steps by 7 days', () => {
    expect(addPeriods('2026-07-13', 1, weekly)).toBe('2026-07-20');
    expect(addPeriods('2026-07-13', -2, weekly)).toBe('2026-06-29');
  });
});

describe('biweekly periods', () => {
  it('anchors to the Monday of the week containing startDate, for all 7 start weekdays', () => {
    for (let i = 0; i < 7; i++) {
      const startDate = addDaysIso('2026-07-13', i); // Mon..Sun of the same week
      const s: PaySchedule = { startDate, frequency: 'biweekly', payDay: 5 };
      expect(firstPeriod(s).key).toBe('2026-07-13');
      expect(firstPeriod(s).end).toBe('2026-07-26');
    }
    // one week later, the anchor moves with it
    const s2: PaySchedule = { startDate: '2026-07-12', frequency: 'biweekly', payDay: 5 };
    expect(firstPeriod(s2).key).toBe('2026-07-06');
  });

  it('period is 14 days, Monday–Sunday ×2', () => {
    const p = periodForDate('2026-07-20', biweekly); // 2nd week of the first period
    expect(p).toMatchObject({ key: '2026-07-13', start: '2026-07-13', end: '2026-07-26' });
    expect(periodDays(p)).toBe(14);
  });

  it('matches the spec preview example: Jul 13 – Jul 26 pays Fri, Jul 31', () => {
    const p = firstPeriod(biweekly);
    expect(p.payDate).toBe('2026-07-31');
    expect(formatPeriodDisplay(p)).toBe('Jul 13 – Jul 26');
    expect(formatPayDate(p)).toBe('Fri, Jul 31');
  });

  it('extends the lattice backward for dates before startDate', () => {
    // day before the anchor week → previous 14-day period 2026-06-29..2026-07-12
    const p = periodForDate('2026-07-12', biweekly);
    expect(p).toMatchObject({ key: '2026-06-29', start: '2026-06-29', end: '2026-07-12' });
  });

  it('addPeriods and periodForDate agree on the lattice before AND after startDate (round-trips)', () => {
    for (let delta = -5; delta <= 5; delta++) {
      const key = addPeriods('2026-07-13', delta, biweekly);
      // key is a period start on the lattice
      expect(periodForDate(key, biweekly).key).toBe(key);
      // any date inside that period maps back to it
      expect(periodForDate(addDaysIso(key, 13), biweekly).key).toBe(key);
      // stepping back returns to the origin
      expect(addPeriods(key, -delta, biweekly)).toBe('2026-07-13');
    }
  });

  it('addPeriods normalizes an off-lattice key to its containing period first', () => {
    // 2026-07-20 is a weekly Monday inside the 2026-07-13 biweekly period
    expect(addPeriods('2026-07-20', 1, biweekly)).toBe('2026-07-27');
  });

  it('crosses Dec→Jan', () => {
    const s: PaySchedule = { startDate: '2025-12-29', frequency: 'biweekly', payDay: 5 };
    const p = firstPeriod(s);
    expect(p).toMatchObject({ key: '2025-12-29', end: '2026-01-11' });
    expect(p.payDate).toBe('2026-01-16');
  });
});

describe('monthly periods', () => {
  it('spans the true calendar month', () => {
    const p = periodForDate('2026-07-17', monthly);
    expect(p).toMatchObject({ key: '2026-07-01', start: '2026-07-01', end: '2026-07-31' });
    expect(periodDays(p)).toBe(31);
  });

  it('handles February and leap years (Feb 2028 has 29 days)', () => {
    expect(periodForDate('2026-02-10', monthly).end).toBe('2026-02-28');
    const leap = periodForDate('2028-02-10', monthly);
    expect(leap.end).toBe('2028-02-29');
    expect(periodDays(leap)).toBe(29);
  });

  it('pay date is payDay of the FOLLOWING month', () => {
    expect(periodForDate('2026-07-17', monthly).payDate).toBe('2026-08-15');
  });

  it('payDay 31 always clamps to the last day of the following month', () => {
    const last: PaySchedule = { ...monthly, payDay: 31 };
    expect(periodForDate('2026-03-10', last).payDate).toBe('2026-04-30'); // 30-day month
    expect(periodForDate('2026-01-10', last).payDate).toBe('2026-02-28'); // Feb, non-leap
    expect(periodForDate('2028-01-10', last).payDate).toBe('2028-02-29'); // Feb, leap
    expect(periodForDate('2026-07-10', last).payDate).toBe('2026-08-31'); // 31-day month
  });

  it('payDay 28 fits every month unclamped', () => {
    const d28: PaySchedule = { ...monthly, payDay: 28 };
    expect(periodForDate('2026-01-10', d28).payDate).toBe('2026-02-28');
  });

  it('crosses Dec→Jan for both period and pay date', () => {
    const p = periodForDate('2026-12-15', monthly);
    expect(p).toMatchObject({ key: '2026-12-01', end: '2026-12-31' });
    expect(p.payDate).toBe('2027-01-15');
  });

  it('addPeriods steps whole months without day clamping issues', () => {
    expect(addPeriods('2026-01-01', 1, monthly)).toBe('2026-02-01');
    expect(addPeriods('2026-01-01', -1, monthly)).toBe('2025-12-01');
    expect(addPeriods('2026-01-01', 13, monthly)).toBe('2027-02-01');
  });
});

describe('getPeriod / firstPeriod / periodCalcOpts', () => {
  it('getPeriod(key) equals periodForDate(key) — off-lattice keys resolve to their container', () => {
    expect(getPeriod('2026-07-20', biweekly)).toEqual(periodForDate('2026-07-20', biweekly));
    expect(getPeriod('2026-07-13', weekly).key).toBe('2026-07-13');
  });

  it('firstPeriod contains startDate (navigation floor), including a future startDate', () => {
    const future: PaySchedule = { startDate: '2026-08-05', frequency: 'weekly', payDay: 5 };
    expect(firstPeriod(future).key).toBe('2026-08-03');
  });

  it('periodCalcOpts flags true months and reports inclusive day counts', () => {
    expect(periodCalcOpts(firstPeriod(weekly), weekly)).toEqual({ days: 7, isMonth: false });
    expect(periodCalcOpts(firstPeriod(biweekly), biweekly)).toEqual({ days: 14, isMonth: false });
    expect(periodCalcOpts(periodForDate('2028-02-10', monthly), monthly)).toEqual({ days: 29, isMonth: true });
  });
});
```

- [ ] **1.3 Run and confirm failure:** `npx jest __tests__/payPeriods.test.ts` → fails with "Cannot find module '../src/utils/payPeriods'".

- [ ] **1.4 Append the schedule types** to `c:\Claude\Truckerspro\src\types\index.ts`. At the very end of the file (after the `CompanyCommissionWeeklySummary` type), add:

```ts
export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';

export type PaySchedule = {
  startDate: string; // YYYY-MM-DD, any date
  frequency: PayFrequency;
  payDay: number; // weekly/biweekly: 1=Mon … 7=Sun; monthly: 1–28, or 31 = last day of month
};

export type PayPeriod = {
  key: string; // YYYY-MM-DD of the period start
  start: string;
  end: string; // inclusive
  payDate: string;
};
```

- [ ] **1.5 Create** `c:\Claude\Truckerspro\src\utils\payPeriods.ts` (complete file):

```ts
import { getWeekKey } from './weekKey';
import type { PaySchedule, PayPeriod } from '../types';

const DAY_MS = 86_400_000;

function toUTC(key: string): Date {
  return new Date(key + 'T00:00:00Z');
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(key: string, n: number): string {
  const d = toUTC(key);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** ISO weekday 1=Mon … 7=Sun for a YYYY-MM-DD key (UTC). */
function isoDow(key: string): number {
  const day = toUTC(key).getUTCDay(); // 0=Sun … 6=Sat
  return day === 0 ? 7 : day;
}

/** Last day number (28–31) of the month at the given UTC year/monthIndex. */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Default for existing users and anyone who skips setup: weekly, paid Friday. */
export function defaultSchedule(today: Date = new Date()): PaySchedule {
  return { startDate: getWeekKey(today), frequency: 'weekly', payDay: 5 };
}

/** Monday of the week containing schedule.startDate — the biweekly lattice anchor. */
function biweeklyAnchor(schedule: PaySchedule): string {
  return getWeekKey(toUTC(schedule.startDate));
}

/** Start key of the period containing `date` (works for dates before the anchor too). */
function periodStartForDate(date: string, schedule: PaySchedule): string {
  switch (schedule.frequency) {
    case 'weekly':
      return getWeekKey(toUTC(date));
    case 'biweekly': {
      const anchor = biweeklyAnchor(schedule);
      const monday = getWeekKey(toUTC(date));
      const diffDays = Math.round((toUTC(monday).getTime() - toUTC(anchor).getTime()) / DAY_MS);
      const steps = Math.floor(diffDays / 14); // floor is negative-safe: extends lattice backward
      return addDays(anchor, steps * 14);
    }
    case 'monthly':
      return date.slice(0, 8) + '01';
  }
}

function payDateFor(start: string, end: string, schedule: PaySchedule): string {
  if (schedule.frequency === 'monthly') {
    const s = toUTC(start);
    const next = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
    const last = lastDayOfMonth(next.getUTCFullYear(), next.getUTCMonth());
    const day = schedule.payDay >= 31 ? last : Math.min(schedule.payDay, last);
    return iso(new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), day)));
  }
  // weekly / biweekly: first payDay weekday strictly AFTER the period's end.
  const candidate = addDays(end, 1);
  const shift = (schedule.payDay - isoDow(candidate) + 7) % 7;
  return addDays(candidate, shift);
}

/** Full period record for a key. Off-lattice keys resolve to their containing period. */
export function getPeriod(key: string, schedule: PaySchedule): PayPeriod {
  const start = periodStartForDate(key, schedule);
  let end: string;
  switch (schedule.frequency) {
    case 'weekly':
      end = addDays(start, 6);
      break;
    case 'biweekly':
      end = addDays(start, 13);
      break;
    case 'monthly': {
      const s = toUTC(start);
      end = iso(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0)));
      break;
    }
  }
  return { key: start, start, end, payDate: payDateFor(start, end, schedule) };
}

/** The period containing `date`. */
export function periodForDate(date: string, schedule: PaySchedule): PayPeriod {
  return getPeriod(date, schedule);
}

/** Step period keys by `delta` periods (normalizes `key` to its period start first). */
export function addPeriods(key: string, delta: number, schedule: PaySchedule): string {
  const start = periodStartForDate(key, schedule);
  switch (schedule.frequency) {
    case 'weekly':
      return addDays(start, delta * 7);
    case 'biweekly':
      return addDays(start, delta * 14);
    case 'monthly': {
      const d = toUTC(start); // always the 1st — setUTCMonth needs no day clamping
      d.setUTCMonth(d.getUTCMonth() + delta);
      return iso(d);
    }
  }
}

/** The period containing schedule.startDate — the navigation floor. */
export function firstPeriod(schedule: PaySchedule): PayPeriod {
  return periodForDate(schedule.startDate, schedule);
}

/** Inclusive day count of a period (7, 14, or 28–31). */
export function periodDays(period: PayPeriod): number {
  return Math.round((toUTC(period.end).getTime() - toUTC(period.start).getTime()) / DAY_MS) + 1;
}

/** Shape consumed by calcOwnerOpSummary's opts.period / buildInsight's opts.period. */
export function periodCalcOpts(
  period: PayPeriod,
  schedule: PaySchedule
): { days: number; isMonth: boolean } {
  return { days: periodDays(period), isMonth: schedule.frequency === 'monthly' };
}

const fmtShort = (key: string) =>
  toUTC(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Jul 13 – Jul 26" (en dash, same style as formatWeekDisplay). */
export function formatPeriodDisplay(period: PayPeriod): string {
  return `${fmtShort(period.start)} – ${fmtShort(period.end)}`;
}

/** "Fri, Jul 31" */
export function formatPayDate(period: PayPeriod): string {
  return toUTC(period.payDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
```

- [ ] **1.6 Run:** `npx jest __tests__/payPeriods.test.ts` → all tests pass. Then `npx tsc --noEmit` → clean. Then `npm test` → full suite green.

- [ ] **1.7 Commit:**
```
git add src/types/index.ts src/utils/payPeriods.ts __tests__/payPeriods.test.ts
git commit -m "feat: pay-period engine (weekly/biweekly/monthly periods + pay dates)"
```

---

## Task 2 — Money math: `toPeriod` + `opts.period` in calculations and insights

**Files**
- Modify: `c:\Claude\Truckerspro\src\utils\calculations.ts`
- Modify: `c:\Claude\Truckerspro\src\utils\insights.ts`
- Test: `c:\Claude\Truckerspro\__tests__\calculations.test.ts` (append; existing tests untouched)

**Interfaces**
- Consumes: `Frequency`, `OtherFrequency` from `src/types` (existing). Does NOT depend on Task 1's engine — `opts.period` is a plain `{ days: number; isMonth: boolean }` literal.
- Produces (from `src/utils/calculations.ts`):
  - `export type CalcPeriod = { days: number; isMonth: boolean }`
  - `export function toPeriod(amount: number, freq: Frequency | OtherFrequency | undefined, period: CalcPeriod): number`
  - `calcOwnerOpSummary(loads, rawExpenses, fuelEntries?, opts?: { mileage?: boolean; period?: CalcPeriod })` — default period `{days: 7, isMonth: false}`, byte-identical to today.
- Produces (from `src/utils/insights.ts`): `buildInsight(kind, thisWeek, lastWeek, opts?: { mileage?: boolean; period?: CalcPeriod })`.
- Back-compat guarantee: all existing call sites pass no `period` and must produce byte-identical numbers (weekly: `amount × (7/7) === amount`; monthly: `(amount × 1) / 4.33 === amount / 4.33` — IEEE-identical).

### Steps

- [ ] **2.1 Append failing tests** to `__tests__/calculations.test.ts`. Add `toPeriod` to the existing import from `'../src/utils/calculations'` (the import block at the top becomes):

```ts
import {
  calcOwnerOpSummary,
  calcCompanyMileSummary,
  calcCompanyCommissionSummary,
  normalizeExpenses,
  toPeriod,
} from '../src/utils/calculations';
```

Then append at the end of the file:

```ts
describe('toPeriod', () => {
  const wk = { days: 7, isMonth: false };
  const bi = { days: 14, isMonth: false };
  const mo31 = { days: 31, isMonth: true };

  it('once → amount, regardless of period', () => {
    expect(toPeriod(100, 'once', wk)).toBe(100);
    expect(toPeriod(100, 'once', bi)).toBe(100);
    expect(toPeriod(100, 'once', mo31)).toBe(100);
  });

  it('daily → amount × period.days', () => {
    expect(toPeriod(10, 'daily', wk)).toBe(70);
    expect(toPeriod(10, 'daily', bi)).toBe(140);
    expect(toPeriod(10, 'daily', mo31)).toBe(310);
  });

  it('weekly → amount × (period.days / 7)', () => {
    expect(toPeriod(100, 'weekly', wk)).toBe(100);
    expect(toPeriod(100, 'weekly', bi)).toBe(200);
    expect(toPeriod(700, 'weekly', mo31)).toBe(3100);
    expect(toPeriod(100, undefined, bi)).toBe(200); // undefined behaves as weekly
  });

  it('monthly → passthrough for true months, ×(days/7)/4.33 otherwise', () => {
    expect(toPeriod(866, 'monthly', mo31)).toBe(866);
    expect(toPeriod(866, 'monthly', wk)).toBeCloseTo(200, 5); // 866 / 4.33
    expect(toPeriod(866, 'monthly', bi)).toBeCloseTo(400, 5); // 866 × 2 / 4.33
  });

  it('weekly period conversion is byte-identical to the legacy toWeekly', () => {
    expect(toPeriod(600, 'monthly', wk)).toBe(600 / 4.33);
    expect(toPeriod(10, 'daily', wk)).toBe(10 * 7);
    expect(toPeriod(123.45, 'weekly', wk)).toBe(123.45);
  });
});

describe('calcOwnerOpSummary with opts.period', () => {
  const loads: LoadEntry[] = [
    {
      id: 'p1', weekKey, driverType: 'owner-op',
      startLocation: 'TX', endLocation: 'CA',
      createdAt: '2026-05-25',
      earnings: 3000, commissionRate: 0.10,
    },
  ];
  const fuel: FuelEntry[] = [
    { id: 'pf1', weekKey, type: 'diesel', cost: 400, createdAt: '2026-05-25T10:00:00Z' },
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
    startOdometer: 0, endOdometer: 0,
  };

  it('doubles weekly fixed expenses over a 14-day period; loads and fuel stay actuals', () => {
    const r = calcOwnerOpSummary(loads, expenses, fuel, { period: { days: 14, isMonth: false } });
    // fixed = (600+250+80+200+50+40) × 2 = 2440; commission = 300; fuel = 400
    expect(r.totalExpenses).toBeCloseTo(2440 + 300 + 400, 5);
    expect(r.totalEarnings).toBe(3000);
  });

  it('passes monthly-frequency amounts through unchanged for a true month period', () => {
    const monthlyTruck = { ...expenses, truckPaymentFrequency: 'monthly' as const };
    const r = calcOwnerOpSummary(loads, monthlyTruck, fuel, { period: { days: 31, isMonth: true } });
    // truck 600 passthrough; weekly items × 31/7
    const fixed = 600 + (250 + 80 + 200 + 50 + 40) * (31 / 7);
    expect(r.totalExpenses).toBeCloseTo(fixed + 300 + 400, 5);
  });

  it('omitting opts.period matches an explicit weekly period exactly', () => {
    const a = calcOwnerOpSummary(loads, expenses, fuel);
    const b = calcOwnerOpSummary(loads, expenses, fuel, { period: { days: 7, isMonth: false } });
    expect(a).toEqual(b);
  });
});
```

- [ ] **2.2 Run and confirm failure:** `npx jest __tests__/calculations.test.ts` → fails ("toPeriod is not a function" / value mismatches).

- [ ] **2.3 Implement in `src/utils/calculations.ts`.** Three edits:

Edit A — imports (line 1). Before:
```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry, OwnerOpWeeklySummary, CompanyMileWeeklySummary, CompanyCommissionWeeklySummary, OtherFrequency } from '../types';
```
After:
```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry, OwnerOpWeeklySummary, CompanyMileWeeklySummary, CompanyCommissionWeeklySummary, Frequency, OtherFrequency } from '../types';
```

Edit B — replace the `toWeekly` helper. Before:
```ts
const toWeekly = (amount: number, freq: OtherFrequency | undefined) =>
  freq === 'monthly' ? amount / 4.33 : freq === 'daily' ? amount * 7 : amount;
```
After:
```ts
export type CalcPeriod = { days: number; isMonth: boolean };

const WEEKLY_PERIOD: CalcPeriod = { days: 7, isMonth: false };

export function toPeriod(
  amount: number,
  freq: Frequency | OtherFrequency | undefined,
  period: CalcPeriod
): number {
  switch (freq) {
    case 'once':
      return amount;
    case 'daily':
      return amount * period.days;
    case 'monthly':
      return period.isMonth ? amount : (amount * (period.days / 7)) / 4.33;
    default: // 'weekly' or undefined
      return amount * (period.days / 7);
  }
}
```

Edit C — `calcOwnerOpSummary` signature + fixed-expense block. Before:
```ts
export function calcOwnerOpSummary(
  loads: LoadEntry[],
  rawExpenses: WeeklyExpenses,
  fuelEntries: FuelEntry[] = [],
  opts?: { mileage?: boolean }
): OwnerOpWeeklySummary {
  const expenses = normalizeExpenses(rawExpenses);
  const weekKey = expenses.weekKey;
  const totalEarnings = loads.reduce((sum, l) => sum + (l.earnings ?? 0) + (l.tonu ?? 0), 0);

  const fixedExpenses =
    toWeekly(expenses.truckPayment, expenses.truckPaymentFrequency) +
    toWeekly(expenses.truckInsurance, expenses.truckInsuranceFrequency) +
    toWeekly(expenses.trailerInsurance, expenses.trailerInsuranceFrequency) +
    toWeekly(expenses.trailerLease, expenses.trailerLeaseFrequency) +
    toWeekly(expenses.iftaCost, expenses.iftaCostFrequency) +
    toWeekly(expenses.adminFee, expenses.adminFeeFrequency) +
    (expenses.otherExpenses ?? []).reduce((s, o) => s + toWeekly(o.amount, o.frequency), 0);
```
After:
```ts
export function calcOwnerOpSummary(
  loads: LoadEntry[],
  rawExpenses: WeeklyExpenses,
  fuelEntries: FuelEntry[] = [],
  opts?: { mileage?: boolean; period?: CalcPeriod }
): OwnerOpWeeklySummary {
  const expenses = normalizeExpenses(rawExpenses);
  const period = opts?.period ?? WEEKLY_PERIOD;
  const weekKey = expenses.weekKey;
  const totalEarnings = loads.reduce((sum, l) => sum + (l.earnings ?? 0) + (l.tonu ?? 0), 0);

  const fixedExpenses =
    toPeriod(expenses.truckPayment, expenses.truckPaymentFrequency, period) +
    toPeriod(expenses.truckInsurance, expenses.truckInsuranceFrequency, period) +
    toPeriod(expenses.trailerInsurance, expenses.trailerInsuranceFrequency, period) +
    toPeriod(expenses.trailerLease, expenses.trailerLeaseFrequency, period) +
    toPeriod(expenses.iftaCost, expenses.iftaCostFrequency, period) +
    toPeriod(expenses.adminFee, expenses.adminFeeFrequency, period) +
    (expenses.otherExpenses ?? []).reduce((s, o) => s + toPeriod(o.amount, o.frequency, period), 0);
```
Everything below (commission, fuel, mileage, netProfit) stays untouched — those are actuals, never converted.

- [ ] **2.4 Implement in `src/utils/insights.ts`.** Four edits:

Edit A — imports. Before:
```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry, Frequency, OtherFrequency } from '../types';
import { calcOwnerOpSummary, normalizeExpenses } from './calculations';
```
After:
```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry, Frequency, OtherFrequency } from '../types';
import { calcOwnerOpSummary, normalizeExpenses, toPeriod, CalcPeriod } from './calculations';
```

Edit B — delete the local `toWeekly` and widen `CalcOpts`. Before:
```ts
const toWeekly = (amount: number, freq: Frequency | OtherFrequency | undefined) =>
  freq === 'monthly' ? amount / 4.33 : freq === 'daily' ? amount * 7 : amount;

type CalcOpts = { mileage?: boolean };
```
After:
```ts
type CalcOpts = { mileage?: boolean; period?: CalcPeriod };
```

Edit C — `expenseRows` becomes period-aware. Replace the whole function. Before (current):
```ts
function expenseRows(w: WeekData): InsightRow[] {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries);
  const e = normalizeExpenses(w.expenses);
  const commission = w.loads.reduce((sum, l) => sum + (l.earnings ?? 0) * (l.commissionRate ?? 0), 0);

  const items: { label: string; weekly: number; freq: Frequency | OtherFrequency }[] = [
    { label: 'Truck payment', weekly: toWeekly(e.truckPayment, e.truckPaymentFrequency), freq: e.truckPaymentFrequency },
    { label: 'Truck insurance', weekly: toWeekly(e.truckInsurance, e.truckInsuranceFrequency), freq: e.truckInsuranceFrequency },
    { label: 'Trailer insurance', weekly: toWeekly(e.trailerInsurance, e.trailerInsuranceFrequency), freq: e.trailerInsuranceFrequency },
    { label: 'Trailer lease', weekly: toWeekly(e.trailerLease, e.trailerLeaseFrequency), freq: e.trailerLeaseFrequency },
    { label: 'IFTA', weekly: toWeekly(e.iftaCost, e.iftaCostFrequency), freq: e.iftaCostFrequency },
    { label: 'Admin fee', weekly: toWeekly(e.adminFee, e.adminFeeFrequency), freq: e.adminFeeFrequency },
    ...(e.otherExpenses ?? []).map((o) => ({
      label: o.label, weekly: toWeekly(o.amount, o.frequency), freq: o.frequency,
    })),
    { label: 'Commission', weekly: commission, freq: 'weekly' },
    { label: 'Diesel', weekly: s.totalDiesel, freq: 'weekly' },
    { label: 'DEF', weekly: s.totalDef, freq: 'weekly' },
  ];

  return items
    .filter((i) => i.weekly > 0)
    .map((i) => {
      const pct = s.totalExpenses > 0 ? `${Math.round((i.weekly / s.totalExpenses) * 100)}% of expenses` : '';
      const freqNote =
        i.freq === 'monthly' ? 'monthly ÷ 4.33'
        : i.freq === 'daily' ? 'daily × 7'
        : i.freq === 'once' ? 'one-time'
        : '';
      const sub = [pct, freqNote].filter(Boolean).join(' · ');
      return { label: i.label, value: fmt(i.weekly), ...(sub ? { sub } : {}) };
    });
}
```
After:
```ts
function expenseRows(w: WeekData, opts?: CalcOpts): InsightRow[] {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries, opts);
  const e = normalizeExpenses(w.expenses);
  const period = opts?.period ?? { days: 7, isMonth: false };
  const isWeeklyPeriod = period.days === 7 && !period.isMonth;
  const commission = w.loads.reduce((sum, l) => sum + (l.earnings ?? 0) * (l.commissionRate ?? 0), 0);

  const items: { label: string; converted: number; freq: Frequency | OtherFrequency; actual?: boolean }[] = [
    { label: 'Truck payment', converted: toPeriod(e.truckPayment, e.truckPaymentFrequency, period), freq: e.truckPaymentFrequency },
    { label: 'Truck insurance', converted: toPeriod(e.truckInsurance, e.truckInsuranceFrequency, period), freq: e.truckInsuranceFrequency },
    { label: 'Trailer insurance', converted: toPeriod(e.trailerInsurance, e.trailerInsuranceFrequency, period), freq: e.trailerInsuranceFrequency },
    { label: 'Trailer lease', converted: toPeriod(e.trailerLease, e.trailerLeaseFrequency, period), freq: e.trailerLeaseFrequency },
    { label: 'IFTA', converted: toPeriod(e.iftaCost, e.iftaCostFrequency, period), freq: e.iftaCostFrequency },
    { label: 'Admin fee', converted: toPeriod(e.adminFee, e.adminFeeFrequency, period), freq: e.adminFeeFrequency },
    ...(e.otherExpenses ?? []).map((o) => ({
      label: o.label, converted: toPeriod(o.amount, o.frequency, period), freq: o.frequency,
    })),
    { label: 'Commission', converted: commission, freq: 'weekly' as const, actual: true },
    { label: 'Diesel', converted: s.totalDiesel, freq: 'weekly' as const, actual: true },
    { label: 'DEF', converted: s.totalDef, freq: 'weekly' as const, actual: true },
  ];

  return items
    .filter((i) => i.converted > 0)
    .map((i) => {
      const pct = s.totalExpenses > 0 ? `${Math.round((i.converted / s.totalExpenses) * 100)}% of expenses` : '';
      const freqNote = i.actual
        ? ''
        : i.freq === 'once'
          ? 'one-time'
          : !isWeeklyPeriod
            ? 'per period'
            : i.freq === 'monthly'
              ? 'monthly ÷ 4.33'
              : i.freq === 'daily'
                ? 'daily × 7'
                : '';
      const sub = [pct, freqNote].filter(Boolean).join(' · ');
      return { label: i.label, value: fmt(i.converted), ...(sub ? { sub } : {}) };
    });
}
```
(Weekly-period behavior is unchanged: `actual` rows and plain-weekly rows had empty notes before and still do; monthly/daily/once notes are identical when `isWeeklyPeriod`.)

Edit D — pass `opts` through in `buildInsight`'s `expenses` case. Before:
```ts
    case 'expenses': {
      rows = expenseRows(thisWeek);
```
After:
```ts
    case 'expenses': {
      rows = expenseRows(thisWeek, opts);
```
(`metric`, `computeChange`, and the `buildInsight` top-line `calcOwnerOpSummary(..., opts)` already forward `opts` — the widened `CalcOpts` type makes `period` flow through them with no further edits.)

- [ ] **2.5 Run:** `npx jest __tests__/calculations.test.ts` → all pass (old + new). `npx tsc --noEmit` → clean. `npm test` → green (existing insight expectations unaffected).

- [ ] **2.6 Commit:**
```
git add src/utils/calculations.ts src/utils/insights.ts __tests__/calculations.test.ts
git commit -m "feat: toPeriod conversion + opts.period in summary and insights (weekly default byte-identical)"
```

---

## Task 3 — Storage + sync + schema-v6

**Files**
- Modify: `c:\Claude\Truckerspro\src\sync\types.ts`
- Modify: `c:\Claude\Truckerspro\src\storage\storage.ts`
- Modify: `c:\Claude\Truckerspro\src\sync\syncEngine.ts`
- Modify: `c:\Claude\Truckerspro\src\sync\migration.ts`
- Create: `c:\Claude\Truckerspro\src\supabase\schema-v6.sql`
- Test: `c:\Claude\Truckerspro\__tests__\storage.test.ts`, `c:\Claude\Truckerspro\__tests__\syncEngine.test.ts`, `c:\Claude\Truckerspro\__tests__\migration.test.ts` (append to each)

**Interfaces**
- Consumes: `PaySchedule` from `src/types` (Task 1).
- Produces (from `src/storage/storage.ts`):
  - `export const PROFILE_SCHEDULE_KEY = 'profile:schedule'`
  - `export const SCHEDULE_BANNER_DISMISSED_KEY = 'profile:schedule_banner_dismissed'`
  - `saveSchedule(schedule: PaySchedule): Promise<void>` — writes local + enqueues `upsertProfile` with `{ schedule }`
  - `saveScheduleLocal(schedule: PaySchedule): Promise<void>` — local write only (used by pull and by signup's direct-insert path)
  - `getSchedule(): Promise<PaySchedule | null>`
  - `getScheduleBannerDismissed(): Promise<boolean>`
  - `setScheduleBannerDismissed(): Promise<void>`
- Produces (from `src/sync/types.ts`): `upsertProfile` payload widened to `{ name?: string; schedule?: PaySchedule }`.
- DB mapping (dispatch + pull): `startDate ↔ schedule_start_date`, `frequency ↔ schedule_frequency`, `payDay ↔ schedule_pay_day`. Missing/NULL `schedule_start_date` on pull ⇒ do not write `profile:schedule` (the "not set up" banner case).

### Steps

- [ ] **3.1 Append failing tests.**

To `__tests__/storage.test.ts` — extend the import block (add `saveSchedule, saveScheduleLocal, getSchedule` to the existing `from '../src/storage/storage'` import, and add a `SYNC_QUEUE_KEY` import):
```ts
import {
  saveLoad,
  getLoadsForWeek,
  deleteLoad,
  saveWeeklyExpenses,
  getWeeklyExpenses,
  getAllWeekKeys,
  saveSchedule,
  saveScheduleLocal,
  getSchedule,
} from '../src/storage/storage';
import { SYNC_QUEUE_KEY } from '../src/sync/types';
```
Append at the end of the file:
```ts
describe('pay schedule storage', () => {
  const schedule = { startDate: '2026-07-15', frequency: 'biweekly' as const, payDay: 5 };

  it('getSchedule returns null when nothing stored', async () => {
    expect(await getSchedule()).toBeNull();
  });

  it('saveSchedule persists locally and enqueues an upsertProfile op with the schedule', async () => {
    await saveSchedule(schedule);
    expect(await getSchedule()).toEqual(schedule);
    const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
    const op = queue[queue.length - 1].op;
    expect(op.kind).toBe('upsertProfile');
    expect(op.payload.schedule).toEqual(schedule);
  });

  it('saveScheduleLocal writes locally without enqueueing', async () => {
    await saveScheduleLocal(schedule);
    expect(await getSchedule()).toEqual(schedule);
    expect(await AsyncStorage.getItem(SYNC_QUEUE_KEY)).toBeNull();
  });
});
```

To `__tests__/syncEngine.test.ts` — append at the end of the file:
```ts
test('flush maps upsertProfile schedule payload to the three profile columns', async () => {
  const eqMock = jest.fn(() => Promise.resolve({ error: null }));
  const updateMock = jest.fn(() => ({ eq: eqMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({ update: updateMock }));
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  await syncEngine.enqueue({
    kind: 'upsertProfile',
    payload: { schedule: { startDate: '2026-07-15', frequency: 'biweekly', payDay: 5 } },
  });
  await syncEngine.flush();

  expect(supabase.from).toHaveBeenCalledWith('profiles');
  expect(updateMock).toHaveBeenCalledTimes(1);
  expect(updateMock.mock.calls[0][0]).toMatchObject({
    schedule_start_date: '2026-07-15',
    schedule_frequency: 'biweekly',
    schedule_pay_day: 5,
  });
  expect(updateMock.mock.calls[0][0].name).toBeUndefined();
  expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
});

test('flush of a name-only upsertProfile does not touch schedule columns', async () => {
  const eqMock = jest.fn(() => Promise.resolve({ error: null }));
  const updateMock = jest.fn(() => ({ eq: eqMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({ update: updateMock }));
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  await syncEngine.enqueue({ kind: 'upsertProfile', payload: { name: 'Fatih' } });
  await syncEngine.flush();

  const row = updateMock.mock.calls[0][0];
  expect(row.name).toBe('Fatih');
  expect(row.schedule_start_date).toBeUndefined();
  expect(row.schedule_frequency).toBeUndefined();
  expect(row.schedule_pay_day).toBeUndefined();
});
```

To `__tests__/migration.test.ts` — append at the end of the file:
```ts
test('Path A uploads a locally stored pay schedule', async () => {
  await AsyncStorage.setItem(
    'profile:schedule',
    JSON.stringify({ startDate: '2026-07-15', frequency: 'biweekly', payDay: 5 })
  );
  const eqMock = jest.fn(() => Promise.resolve({ error: null }));
  const updateMock = jest.fn(() => ({ eq: eqMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({
    upsert: upsertMock,
    update: updateMock,
    ...selectChain([]),
  }));

  const { runMigrationAndPull } = require('../src/sync/migration');
  await runMigrationAndPull('user-1');

  expect(updateMock).toHaveBeenCalled();
  expect(updateMock.mock.calls[0][0]).toMatchObject({
    schedule_start_date: '2026-07-15',
    schedule_frequency: 'biweekly',
    schedule_pay_day: 5,
  });
});

test('pullFromSupabase maps schedule columns into profile:schedule', async () => {
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return selectChain([{
        user_id: 'user-1', driver_type: 'owner-op', name: 'D',
        schedule_start_date: '2026-07-15', schedule_frequency: 'biweekly', schedule_pay_day: 3,
      }]);
    }
    return selectChain([]);
  });

  const { pullFromSupabase } = require('../src/storage/storage');
  await pullFromSupabase('user-1');

  expect(JSON.parse((await AsyncStorage.getItem('profile:schedule'))!)).toEqual({
    startDate: '2026-07-15',
    frequency: 'biweekly',
    payDay: 3,
  });
});

test('pullFromSupabase leaves profile:schedule unset when schedule_start_date is null', async () => {
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return selectChain([{
        user_id: 'user-1', driver_type: 'owner-op', name: 'D',
        schedule_start_date: null, schedule_frequency: 'weekly', schedule_pay_day: 5,
      }]);
    }
    return selectChain([]);
  });

  const { pullFromSupabase } = require('../src/storage/storage');
  await pullFromSupabase('user-1');

  expect(await AsyncStorage.getItem('profile:schedule')).toBeNull();
});
```
(`upsertMock` and `selectChain` already exist at the top of `migration.test.ts` and are in scope.)

- [ ] **3.2 Run and confirm failure:** `npx jest __tests__/storage.test.ts __tests__/syncEngine.test.ts __tests__/migration.test.ts` → new tests fail (missing exports / unmapped columns).

- [ ] **3.3 Implement `src/sync/types.ts`.** Two edits. Before:
```ts
import type { LoadEntry, FuelEntry, WeeklyExpenses } from '../types';
```
After:
```ts
import type { LoadEntry, FuelEntry, WeeklyExpenses, PaySchedule } from '../types';
```
Before:
```ts
  | { kind: 'upsertProfile'; payload: { name: string } };
```
After:
```ts
  | { kind: 'upsertProfile'; payload: { name?: string; schedule?: PaySchedule } };
```

- [ ] **3.4 Implement `src/storage/storage.ts`.** Three edits.

Edit A — imports (top of file). Before:
```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../types';
```
After:
```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry, PaySchedule } from '../types';
```

Edit B — after the existing `getDriverType` function (and before `wipeAll`), insert:
```ts
export const PROFILE_SCHEDULE_KEY = 'profile:schedule';
export const SCHEDULE_BANNER_DISMISSED_KEY = 'profile:schedule_banner_dismissed';

export async function saveScheduleLocal(schedule: PaySchedule): Promise<void> {
  await AsyncStorage.setItem(PROFILE_SCHEDULE_KEY, JSON.stringify(schedule));
}

export async function saveSchedule(schedule: PaySchedule): Promise<void> {
  await saveScheduleLocal(schedule);
  await syncEngine.enqueue({ kind: 'upsertProfile', payload: { schedule } });
}

export async function getSchedule(): Promise<PaySchedule | null> {
  const raw = await AsyncStorage.getItem(PROFILE_SCHEDULE_KEY);
  return raw ? (JSON.parse(raw) as PaySchedule) : null;
}

export async function getScheduleBannerDismissed(): Promise<boolean> {
  return (await AsyncStorage.getItem(SCHEDULE_BANNER_DISMISSED_KEY)) === 'true';
}

export async function setScheduleBannerDismissed(): Promise<void> {
  await AsyncStorage.setItem(SCHEDULE_BANNER_DISMISSED_KEY, 'true');
}
```

Edit C — pull mapping. In `pullFromSupabase`, the profiles loop. Before:
```ts
  // Profiles (single row per user with driver_type + name)
  for (const row of profRes.data ?? []) {
    await AsyncStorage.setItem(PROFILE_NAME_KEY, row.name ?? '');
    await AsyncStorage.setItem(PROFILE_DRIVER_TYPE_KEY, row.driver_type);
  }
```
After:
```ts
  // Profiles (single row per user with driver_type + name + pay schedule)
  for (const row of profRes.data ?? []) {
    await AsyncStorage.setItem(PROFILE_NAME_KEY, row.name ?? '');
    await AsyncStorage.setItem(PROFILE_DRIVER_TYPE_KEY, row.driver_type);
    if (row.schedule_start_date) {
      const schedule: PaySchedule = {
        startDate: String(row.schedule_start_date).slice(0, 10),
        frequency: row.schedule_frequency ?? 'weekly',
        payDay: row.schedule_pay_day != null ? Number(row.schedule_pay_day) : 5,
      };
      await saveScheduleLocal(schedule);
    }
  }
```

- [ ] **3.5 Implement `src/sync/syncEngine.ts`.** Replace the `upsertProfile` case in `dispatch`. Before:
```ts
    case 'upsertProfile': {
      const { error } = await supabase.from('profiles').update({
        name: op.payload.name,
        updated_at: new Date().toISOString(),
      }).eq('user_id', userId);
      if (error) throw new Error(error.message);
      return;
    }
```
After:
```ts
    case 'upsertProfile': {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (op.payload.name !== undefined) update.name = op.payload.name;
      if (op.payload.schedule) {
        update.schedule_start_date = op.payload.schedule.startDate;
        update.schedule_frequency = op.payload.schedule.frequency;
        update.schedule_pay_day = op.payload.schedule.payDay;
      }
      const { error } = await supabase.from('profiles').update(update).eq('user_id', userId);
      if (error) throw new Error(error.message);
      return;
    }
```

- [ ] **3.6 Implement `src/sync/migration.ts`.** Two edits.

Edit A — `hasLocalData` includes the schedule key. Before:
```ts
  return all.some((k) =>
    k.startsWith('loads:') ||
    k.startsWith('expenses:') ||
    k.startsWith('fuel:') ||
    k === 'profile:name'
  );
```
After:
```ts
  return all.some((k) =>
    k.startsWith('loads:') ||
    k.startsWith('expenses:') ||
    k.startsWith('fuel:') ||
    k === 'profile:name' ||
    k === 'profile:schedule'
  );
```

Edit B — `enqueueAllLocal` uploads the schedule. Before:
```ts
    } else if (k === 'profile:name') {
      // Only the name key: 'profile:driver_type' must never be uploaded as a name.
      const name = await AsyncStorage.getItem(k);
      if (name == null) continue;
      await syncEngine.enqueue({
        kind: 'upsertProfile',
        payload: { name },
      });
    }
```
After:
```ts
    } else if (k === 'profile:name') {
      // Only the name key: 'profile:driver_type' must never be uploaded as a name.
      const name = await AsyncStorage.getItem(k);
      if (name == null) continue;
      await syncEngine.enqueue({
        kind: 'upsertProfile',
        payload: { name },
      });
    } else if (k === 'profile:schedule') {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      await syncEngine.enqueue({
        kind: 'upsertProfile',
        payload: { schedule: JSON.parse(raw) },
      });
    }
```

- [ ] **3.7 Create** `c:\Claude\Truckerspro\src\supabase\schema-v6.sql` (complete file):
```sql
-- schema-v6: per-driver pay schedule on profiles.
-- Additive and idempotent — safe to run on a live database.
alter table profiles add column if not exists schedule_start_date date;
alter table profiles add column if not exists schedule_frequency text not null default 'weekly';
alter table profiles add column if not exists schedule_pay_day int not null default 5;
```
Do NOT apply it to the live DB from this task — that is a controller-only follow-up.

- [ ] **3.8 Run:** `npx jest __tests__/storage.test.ts __tests__/syncEngine.test.ts __tests__/migration.test.ts` → pass. `npx tsc --noEmit` → clean. `npm test` → green.

- [ ] **3.9 Commit:**
```
git add src/sync/types.ts src/storage/storage.ts src/sync/syncEngine.ts src/sync/migration.ts src/supabase/schema-v6.sql __tests__/storage.test.ts __tests__/syncEngine.test.ts __tests__/migration.test.ts
git commit -m "feat: pay-schedule storage + profile sync + schema-v6"
```

---

## Task 4 — WeekContext becomes the period provider

**Files**
- Modify: `c:\Claude\Truckerspro\src\context\WeekContext.tsx` (full rewrite below; `formatWeekDisplay` export and `useWeek`/`weekKey` names are kept)

**Interfaces**
- Consumes: `defaultSchedule`, `firstPeriod`, `getPeriod`, `addPeriods`, `periodForDate` from `src/utils/payPeriods` (Task 1); `getSchedule` from `src/storage/storage` (Task 3); `getCurrentWeekKey` from `src/utils/weekKey`.
- Produces — `useWeek()` returns:
  ```ts
  {
    weekKey: string;               // current period key (weekly = today's week key, unchanged)
    period: PayPeriod;             // full record for weekKey
    schedule: PaySchedule;         // loaded schedule, or weekly default until loaded
    scheduleLoaded: boolean;       // async load finished
    needsSetup: boolean;           // no stored schedule (existing-account banner case)
    reloadSchedule: () => Promise<void>;
    canGoPrev: boolean;
    canGoNext: boolean;
    goToPrev: () => void;
    goToNext: () => void;
  }
  ```
- Behavior contract: before the async load completes, provider defaults to `defaultSchedule()` (weekly / current week) — byte-identical to today's behavior, so all screens render normally and re-render once loaded. Floor = `firstPeriod(schedule)`; ceiling = one period ahead of the period containing today (if `startDate` is in the future, home clamps up to the first period and ceiling = first period + 1). Existing back-compat: with the default schedule, floor = current week and ceiling = next week — exactly today's clamps. All existing consumers (`useWeek().weekKey`, `goToPrev`, …) keep compiling and behaving identically until Task 6 adopts the new fields.
- No new unit tests: the clamp/step logic is a thin composition of the Task 1 engine (fully tested); React context rendering is exercised by the manual checklist. The full suite plus `tsc` must stay green.

### Steps

- [ ] **4.1 Rewrite** `c:\Claude\Truckerspro\src\context\WeekContext.tsx` (complete file):

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentWeekKey } from '../utils/weekKey';
import {
  defaultSchedule,
  firstPeriod,
  getPeriod,
  addPeriods,
  periodForDate,
} from '../utils/payPeriods';
import { getSchedule } from '../storage/storage';
import type { PaySchedule, PayPeriod } from '../types';

// Kept for History fallbacks and any legacy call site (period-aware formatting
// comes from payPeriods.formatPeriodDisplay via the context's `period`).
export function formatWeekDisplay(weekKey: string): string {
  const mon = new Date(weekKey + 'T00:00:00Z');
  const sun = new Date(weekKey + 'T00:00:00Z');
  sun.setUTCDate(sun.getUTCDate() + 6);
  const f = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${f(mon)} – ${f(sun)}`;
}

type WeekContextType = {
  weekKey: string;
  period: PayPeriod;
  schedule: PaySchedule;
  scheduleLoaded: boolean;
  needsSetup: boolean;
  reloadSchedule: () => Promise<void>;
  canGoPrev: boolean;
  canGoNext: boolean;
  goToPrev: () => void;
  goToNext: () => void;
};

const BOOT_SCHEDULE = defaultSchedule();

const WeekContext = createContext<WeekContextType>({
  weekKey: getCurrentWeekKey(),
  period: getPeriod(getCurrentWeekKey(), BOOT_SCHEDULE),
  schedule: BOOT_SCHEDULE,
  scheduleLoaded: false,
  needsSetup: false,
  reloadSchedule: async () => {},
  canGoPrev: false,
  canGoNext: true,
  goToPrev: () => {},
  goToNext: () => {},
});

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Period the dashboard opens on: today's period, clamped up to the first period
 *  when startDate lies in the future. */
function homeKey(schedule: PaySchedule): string {
  const current = periodForDate(todayIso(), schedule).key;
  const floor = firstPeriod(schedule).key;
  return current < floor ? floor : current;
}

export function WeekProvider({ children }: { children: React.ReactNode }) {
  const [schedule, setSchedule] = useState<PaySchedule>(() => defaultSchedule());
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [weekKey, setWeekKey] = useState<string>(() => getCurrentWeekKey());

  async function reloadSchedule(): Promise<void> {
    const stored = await getSchedule();
    const next = stored ?? defaultSchedule();
    setSchedule(next);
    setNeedsSetup(!stored);
    setScheduleLoaded(true);
    setWeekKey(homeKey(next));
  }

  useEffect(() => {
    reloadSchedule();
  }, []);

  const floorKey = firstPeriod(schedule).key;
  const ceilKey = addPeriods(homeKey(schedule), 1, schedule);
  const canGoPrev = weekKey > floorKey;
  const canGoNext = weekKey < ceilKey;

  return (
    <WeekContext.Provider
      value={{
        weekKey,
        period: getPeriod(weekKey, schedule),
        schedule,
        scheduleLoaded,
        needsSetup,
        reloadSchedule,
        canGoPrev,
        canGoNext,
        goToPrev: () => setWeekKey((k) => (canGoPrev ? addPeriods(k, -1, schedule) : k)),
        goToNext: () => setWeekKey((k) => (canGoNext ? addPeriods(k, 1, schedule) : k)),
      }}
    >
      {children}
    </WeekContext.Provider>
  );
}

export function useWeek() {
  return useContext(WeekContext);
}
```

- [ ] **4.2 Run:** `npx tsc --noEmit` → clean (all existing `useWeek()` destructures still typecheck — the return type is a superset; `formatWeekDisplay` still exported). `npm test` → green.

- [ ] **4.3 Commit:**
```
git add src/context/WeekContext.tsx
git commit -m "feat: WeekContext becomes the pay-period provider (schedule-aware nav + clamps)"
```

---

## Task 5 — PayScheduleScreen, banner component, Signup integration, App metadata

**Files**
- Create: `c:\Claude\Truckerspro\src\screens\PayScheduleScreen.tsx`
- Create: `c:\Claude\Truckerspro\src\components\PayScheduleBanner.tsx`
- Modify: `c:\Claude\Truckerspro\src\screens\SignupScreen.tsx`
- Modify: `c:\Claude\Truckerspro\App.tsx`

**Interfaces**
- Consumes: `defaultSchedule`, `firstPeriod`, `formatPeriodDisplay`, `formatPayDate` from `src/utils/payPeriods` (Task 1); `saveSchedule`, `saveScheduleLocal`, `getScheduleBannerDismissed`, `setScheduleBannerDismissed` from `src/storage/storage` (Task 3); `useWeek` (`scheduleLoaded`, `needsSetup`) from `src/context/WeekContext` (Task 4); `PaySchedule`, `PayFrequency` from `src/types`.
- Produces (from `src/screens/PayScheduleScreen.tsx`):
  - `export function PayScheduleForm(props: { value: PaySchedule; onChange: (s: PaySchedule) => void }): JSX.Element` — start-date calendar button + custom month-grid modal, frequency pills, pay-day picker, live preview line. Reused inline by Signup.
  - `export function PayScheduleModal(props: { visible: boolean; initialSchedule: PaySchedule | null; onClose: () => void; onSaved: () => void | Promise<void> }): JSX.Element` — full-screen editor; Save calls `saveSchedule(draft)` then `onSaved()` then `onClose()`. Carries the note "Past periods stay as recorded; new periods follow the new schedule."
- Produces (from `src/components/PayScheduleBanner.tsx`):
  - `export function PayScheduleBanner(props: { onOpen: () => void }): JSX.Element | null` — renders only when `scheduleLoaded && needsSetup && !dismissed`; dismiss persists `profile:schedule_banner_dismissed`; never blocks usage.
- Signup contract: schedule state defaults to `defaultSchedule()`; goes into `auth.signUp` `options.data` as `schedule_start_date` / `schedule_frequency` / `schedule_pay_day` (confirm-flow) AND into the direct `profiles` insert (no-confirm flow) AND `saveScheduleLocal` on the direct path.
- App contract: `createProfileFromMetadata` copies the three `schedule_*` metadata keys into the profile insert when present.
- No jest tests (pure UI; logic lives in the tested engine). `tsc` + full suite must stay green.

### Steps

- [ ] **5.1 Create** `c:\Claude\Truckerspro\src\screens\PayScheduleScreen.tsx` (complete file):

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { saveSchedule } from '../storage/storage';
import {
  defaultSchedule, firstPeriod, formatPeriodDisplay, formatPayDate,
} from '../utils/payPeriods';
import type { PaySchedule, PayFrequency } from '../types';

const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: 'Mon' }, { day: 2, label: 'Tue' }, { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' }, { day: 5, label: 'Fri' }, { day: 6, label: 'Sat' },
  { day: 7, label: 'Sun' },
];

const FREQUENCIES: { value: PayFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toUTC(key: string): Date {
  return new Date(key + 'T00:00:00Z');
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatFullDate(key: string): string {
  return toUTC(key).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

type CalendarModalProps = {
  visible: boolean;
  value: string; // YYYY-MM-DD
  onSelect: (key: string) => void;
  onClose: () => void;
};

function CalendarModal({ visible, value, onSelect, onClose }: CalendarModalProps) {
  const insets = useSafeAreaInsets();
  const [monthStart, setMonthStart] = useState(value.slice(0, 8) + '01');

  useEffect(() => {
    if (visible) setMonthStart(value.slice(0, 8) + '01');
  }, [visible, value]);

  const first = toUTC(monthStart);
  const year = first.getUTCFullYear();
  const month = first.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDow = first.getUTCDay() === 0 ? 7 : first.getUTCDay(); // 1=Mon … 7=Sun
  const cells: (number | null)[] = [
    ...Array(firstDow - 1).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shiftMonth(delta: number) {
    const d = toUTC(monthStart);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonthStart(iso(d));
  }

  const keyFor = (day: number) => iso(new Date(Date.UTC(year, month, day)));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>Start date</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={C.sub} />
            </TouchableOpacity>
          </View>
          <View style={s.calNav}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} style={s.calNavBtn}>
              <Ionicons name="chevron-back" size={18} color={C.sub} />
            </TouchableOpacity>
            <Text style={s.calMonth}>{MONTH_NAMES[month]} {year}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} style={s.calNavBtn}>
              <Ionicons name="chevron-forward" size={18} color={C.sub} />
            </TouchableOpacity>
          </View>
          <View style={s.calGrid}>
            {WEEKDAYS.map((w) => (
              <Text key={w.day} style={s.calDow}>{w.label[0]}</Text>
            ))}
            {cells.map((day, i) =>
              day === null ? (
                <View key={i} style={s.calCell} />
              ) : (
                <TouchableOpacity
                  key={i}
                  style={s.calCell}
                  onPress={() => { onSelect(keyFor(day)); onClose(); }}
                  activeOpacity={0.7}
                >
                  <View style={[s.calCellInner, keyFor(day) === value && s.calCellActive]}>
                    <Text style={[s.calCellText, keyFor(day) === value && s.calCellTextActive]}>
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function PayScheduleForm({
  value, onChange,
}: {
  value: PaySchedule;
  onChange: (s: PaySchedule) => void;
}) {
  const [calOpen, setCalOpen] = useState(false);
  const preview = firstPeriod(value);

  function setFrequency(frequency: PayFrequency) {
    let payDay = value.payDay;
    if (frequency !== 'monthly' && payDay > 7) payDay = 5; // day-of-month → weekday reset
    onChange({ ...value, frequency, payDay });
  }

  return (
    <View>
      <Text style={s.label}>START DATE</Text>
      <TouchableOpacity style={s.dateBtn} onPress={() => setCalOpen(true)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={18} color={C.sub} />
        <Text style={s.dateText}>{formatFullDate(value.startDate)}</Text>
        <Ionicons name="chevron-down" size={16} color={C.sub} />
      </TouchableOpacity>

      <Text style={s.label}>PAID EVERY</Text>
      <View style={s.pillRow}>
        {FREQUENCIES.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[s.pill, value.frequency === f.value && s.pillActive]}
            onPress={() => setFrequency(f.value)}
            activeOpacity={0.8}
          >
            <Text style={[s.pillText, value.frequency === f.value && s.pillTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={s.label}>{value.frequency === 'monthly' ? 'PAY DAY OF MONTH' : 'PAY DAY'}</Text>
      {value.frequency === 'monthly' ? (
        <View style={s.dayGrid}>
          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
            <TouchableOpacity
              key={d}
              style={[s.dayCell, value.payDay === d && s.dayCellActive]}
              onPress={() => onChange({ ...value, payDay: d })}
              activeOpacity={0.7}
            >
              <Text style={[s.dayCellText, value.payDay === d && s.dayCellTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[s.lastDayBtn, value.payDay === 31 && s.dayCellActive]}
            onPress={() => onChange({ ...value, payDay: 31 })}
            activeOpacity={0.7}
          >
            <Text style={[s.dayCellText, value.payDay === 31 && s.dayCellTextActive]}>
              Last day
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={s.pillRow}>
          {WEEKDAYS.map((w) => (
            <TouchableOpacity
              key={w.day}
              style={[s.dowPill, value.payDay === w.day && s.pillActive]}
              onPress={() => onChange({ ...value, payDay: w.day })}
              activeOpacity={0.8}
            >
              <Text style={[s.dowPillText, value.payDay === w.day && s.pillTextActive]}>
                {w.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={s.previewBox}>
        <Ionicons name="information-circle-outline" size={16} color={C.accent} />
        <Text style={s.previewText}>
          Periods: {formatPeriodDisplay(preview)} · first pay day {formatPayDate(preview)}
        </Text>
      </View>

      <CalendarModal
        visible={calOpen}
        value={value.startDate}
        onSelect={(d) => onChange({ ...value, startDate: d })}
        onClose={() => setCalOpen(false)}
      />
    </View>
  );
}

export function PayScheduleModal({
  visible, initialSchedule, onClose, onSaved,
}: {
  visible: boolean;
  initialSchedule: PaySchedule | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<PaySchedule>(() => initialSchedule ?? defaultSchedule());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(initialSchedule ?? defaultSchedule());
  }, [visible]);

  async function handleSave() {
    setSaving(true);
    await saveSchedule(draft);
    setSaving(false);
    await onSaved();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top }]}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Pay Schedule</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView
          contentContainerStyle={[s.body, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <PayScheduleForm value={draft} onChange={setDraft} />
          <Text style={s.note}>
            Past periods stay as recorded; new periods follow the new schedule.
          </Text>
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Schedule'}</Text>
            <Ionicons name="checkmark" size={20} color={C.accentText} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: C.text },
  body: { padding: 16 },
  label: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16, padding: 16,
  },
  dateText: { flex: 1, fontSize: 16, color: C.text, fontWeight: '600' },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  pill: {
    flex: 1, paddingVertical: 12, borderRadius: 999,
    backgroundColor: C.card, alignItems: 'center',
  },
  pillActive: { backgroundColor: C.accent },
  pillText: { fontSize: 13, fontWeight: '700', color: C.sub },
  pillTextActive: { color: C.accentText, fontWeight: '800' },
  dowPill: {
    flexGrow: 1, flexBasis: '12%', paddingVertical: 10, borderRadius: 12,
    backgroundColor: C.card, alignItems: 'center',
  },
  dowPillText: { fontSize: 12, fontWeight: '700', color: C.sub },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayCell: {
    width: '12%', flexGrow: 1, aspectRatio: 1.2, borderRadius: 10,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  dayCellActive: { backgroundColor: C.accent },
  dayCellText: { fontSize: 13, fontWeight: '700', color: C.sub },
  dayCellTextActive: { color: C.accentText, fontWeight: '800' },
  lastDayBtn: {
    flexGrow: 2, flexBasis: '26%', aspectRatio: undefined, paddingVertical: 10,
    borderRadius: 10, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  previewBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 14, padding: 12, marginTop: 20,
  },
  previewText: { flex: 1, fontSize: 13, color: C.text, fontWeight: '600' },
  note: { fontSize: 12, color: C.muted, marginTop: 16, lineHeight: 18 },
  saveBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 16,
  },
  saveBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, paddingBottom: 12,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  calNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 8,
  },
  calNavBtn: { padding: 8 },
  calMonth: { fontSize: 15, fontWeight: '800', color: C.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  calDow: {
    width: `${100 / 7}%`, textAlign: 'center', fontSize: 11,
    fontWeight: '700', color: C.muted, paddingVertical: 6,
  },
  calCell: {
    width: `${100 / 7}%`, aspectRatio: 1.15,
    alignItems: 'center', justifyContent: 'center',
  },
  calCellInner: {
    width: 36, height: 36, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  calCellActive: { backgroundColor: C.accent },
  calCellText: { fontSize: 14, color: C.text, fontWeight: '600' },
  calCellTextActive: { color: C.accentText, fontWeight: '800' },
});
```

- [ ] **5.2 Create** `c:\Claude\Truckerspro\src\components\PayScheduleBanner.tsx` (complete file):

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeek } from '../context/WeekContext';
import { getScheduleBannerDismissed, setScheduleBannerDismissed } from '../storage/storage';
import { C } from '../theme';

export function PayScheduleBanner({ onOpen }: { onOpen: () => void }) {
  const { scheduleLoaded, needsSetup } = useWeek();
  const [dismissed, setDismissed] = useState(true); // hidden until we know

  useEffect(() => {
    getScheduleBannerDismissed().then(setDismissed);
  }, []);

  if (!scheduleLoaded || !needsSetup || dismissed) return null;

  return (
    <View style={s.banner}>
      <Ionicons name="calendar-outline" size={18} color={C.accent} />
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Set your pay schedule</Text>
        <Text style={s.sub}>Weekly (Mon–Sun) is used until you do.</Text>
      </View>
      <TouchableOpacity style={s.setBtn} onPress={onOpen} activeOpacity={0.85}>
        <Text style={s.setBtnText}>Set up</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={async () => {
          await setScheduleBannerDismissed();
          setDismissed(true);
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={C.sub} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.cardElevated, borderRadius: 16, padding: 12, marginBottom: 12,
  },
  title: { fontSize: 13, fontWeight: '800', color: C.text },
  sub: { fontSize: 11, color: C.sub, marginTop: 1 },
  setBtn: {
    backgroundColor: C.accent, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  setBtnText: { color: C.accentText, fontSize: 12, fontWeight: '800' },
});
```

- [ ] **5.3 Modify `src/screens/SignupScreen.tsx`.** Five edits.

Edit A — imports. Before:
```ts
import { supabase } from '../supabase/client';
import { DriverTypeGrid, DriverTypeChoice } from '../components/DriverTypeGrid';
import { saveDriverType } from '../storage/storage';
import { C } from '../theme';
```
After:
```ts
import { supabase } from '../supabase/client';
import { DriverTypeGrid, DriverTypeChoice } from '../components/DriverTypeGrid';
import { saveDriverType, saveScheduleLocal } from '../storage/storage';
import { PayScheduleForm } from './PayScheduleScreen';
import { defaultSchedule } from '../utils/payPeriods';
import type { PaySchedule } from '../types';
import { C } from '../theme';
```

Edit B — state. Before:
```ts
  const [driverType, setDriverType] = useState<DriverTypeChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
```
After:
```ts
  const [driverType, setDriverType] = useState<DriverTypeChoice | null>(null);
  const [schedule, setSchedule] = useState<PaySchedule>(() => defaultSchedule());
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
```

Edit C — signUp metadata. Before:
```ts
    const { data, error: signErr } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { data: { driver_type: driverType, name: name.trim() } },
    });
```
After:
```ts
    const { data, error: signErr } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: {
        data: {
          driver_type: driverType,
          name: name.trim(),
          schedule_start_date: schedule.startDate,
          schedule_frequency: schedule.frequency,
          schedule_pay_day: schedule.payDay,
        },
      },
    });
```

Edit D — direct-insert path. Before:
```ts
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
After:
```ts
    // Confirmation disabled — session exists, keep the immediate flow.
    const { error: profErr } = await supabase.from('profiles').insert({
      user_id: data.user.id,
      driver_type: driverType,
      name: name.trim(),
      schedule_start_date: schedule.startDate,
      schedule_frequency: schedule.frequency,
      schedule_pay_day: schedule.payDay,
    });
    if (profErr) {
      setSubmitting(false);
      setError('Account created but profile setup failed. Please sign in.');
      return;
    }

    await saveDriverType(driverType);
    await saveScheduleLocal(schedule);
    setSubmitting(false);
```

Edit E — inline collapsed section, between the driver-type grid and the error line. Before:
```tsx
            <Text style={[s.label, { marginTop: 16 }]}>I AM A...</Text>
            <DriverTypeGrid selected={driverType} onSelect={setDriverType} />

            {error ? <Text style={s.error}>{error}</Text> : null}
```
After:
```tsx
            <Text style={[s.label, { marginTop: 16 }]}>I AM A...</Text>
            <DriverTypeGrid selected={driverType} onSelect={setDriverType} />

            <TouchableOpacity
              style={s.scheduleToggle}
              onPress={() => setScheduleOpen((v) => !v)}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar-outline" size={18} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text style={s.scheduleToggleTitle}>Pay schedule</Text>
                <Text style={s.scheduleToggleSub}>
                  {schedule.frequency === 'weekly' ? 'Weekly' : schedule.frequency === 'biweekly' ? 'Bi-weekly' : 'Monthly'} — tap to customize (optional)
                </Text>
              </View>
              <Ionicons name={scheduleOpen ? 'chevron-up' : 'chevron-down'} size={18} color={C.sub} />
            </TouchableOpacity>
            {scheduleOpen && <PayScheduleForm value={schedule} onChange={setSchedule} />}

            {error ? <Text style={s.error}>{error}</Text> : null}
```
And append to the `StyleSheet.create` block (before the closing `});`), after the `linkAccent` entry:
```ts
  scheduleToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 8,
  },
  scheduleToggleTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  scheduleToggleSub: { fontSize: 12, color: C.sub, marginTop: 1 },
```

- [ ] **5.4 Modify `App.tsx`** — `createProfileFromMetadata` copies schedule metadata. Before:
```ts
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
After:
```ts
async function createProfileFromMetadata(uid: string): Promise<{ driver_type: string; name: string } | null> {
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.user_metadata as {
    driver_type?: string;
    name?: string;
    schedule_start_date?: string;
    schedule_frequency?: string;
    schedule_pay_day?: number;
  } | undefined;
  if (!meta?.driver_type) return null;
  const { error } = await supabase.from('profiles').insert({
    user_id: uid,
    driver_type: meta.driver_type,
    name: meta.name ?? '',
    ...(meta.schedule_start_date
      ? {
          schedule_start_date: meta.schedule_start_date,
          schedule_frequency: meta.schedule_frequency ?? 'weekly',
          schedule_pay_day: meta.schedule_pay_day ?? 5,
        }
      : {}),
  });
  if (error) return null;
  return { driver_type: meta.driver_type, name: meta.name ?? '' };
}
```
(The subsequent `runMigrationAndPull` in `bootstrap` pulls those columns into `profile:schedule` — no further App change needed.)

- [ ] **5.5 Run:** `npx tsc --noEmit` → clean. `npm test` → green.

- [ ] **5.6 Commit:**
```
git add src/screens/PayScheduleScreen.tsx src/components/PayScheduleBanner.tsx src/screens/SignupScreen.tsx App.tsx
git commit -m "feat: pay-schedule editor + signup integration + first-login banner component"
```

---

## Task 6 — Dashboards period bar + History period rendering

**Files**
- Create: `c:\Claude\Truckerspro\src\components\PeriodBar.tsx`
- Modify: `c:\Claude\Truckerspro\src\screens\owner-op\OwnerOpDashboard.tsx` (covers owner-op AND lease)
- Modify: `c:\Claude\Truckerspro\src\screens\company-mile\CompanyMileDashboard.tsx`
- Modify: `c:\Claude\Truckerspro\src\screens\company-commission\CompanyCommissionDashboard.tsx`
- Modify: `c:\Claude\Truckerspro\src\screens\owner-op\OwnerOpHistory.tsx`
- Modify: `c:\Claude\Truckerspro\src\screens\company-mile\CompanyMileHistory.tsx`
- Modify: `c:\Claude\Truckerspro\src\screens\company-commission\CompanyCommissionHistory.tsx`

**Interfaces**
- Consumes: `useWeek()` fields `period`, `schedule`, `reloadSchedule`, `canGoPrev/Next`, `goToPrev/Next` (Task 4); `getPeriod`, `addPeriods`, `periodCalcOpts`, `formatPeriodDisplay`, `formatPayDate` from `src/utils/payPeriods` (Task 1); `CalcPeriod`-shaped `opts.period` on `calcOwnerOpSummary`/`buildInsight` (Task 2); `PayScheduleModal` (Task 5); `PayScheduleBanner` (Task 5).
- Produces: `export function PeriodBar(props: { onOpenSchedule: () => void }): JSX.Element` — prev/next chevrons, period range, "Pay day Fri, Jul 31" line, calendar icon opening the schedule editor.

### Steps

- [ ] **6.1 Create** `c:\Claude\Truckerspro\src\components\PeriodBar.tsx` (complete file):

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWeek } from '../context/WeekContext';
import { formatPeriodDisplay, formatPayDate } from '../utils/payPeriods';
import { C } from '../theme';

export function PeriodBar({ onOpenSchedule }: { onOpenSchedule: () => void }) {
  const { period, goToPrev, goToNext, canGoPrev, canGoNext } = useWeek();
  return (
    <View style={s.card}>
      <TouchableOpacity
        onPress={goToPrev}
        disabled={!canGoPrev}
        style={[s.navBtn, !canGoPrev && s.navBtnDisabled]}
      >
        <Ionicons name="chevron-back" size={20} color={C.sub} />
      </TouchableOpacity>
      <View style={s.center}>
        <Text style={s.range}>{formatPeriodDisplay(period)}</Text>
        <Text style={s.payText}>Pay day {formatPayDate(period)}</Text>
      </View>
      <TouchableOpacity onPress={onOpenSchedule} style={s.calBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="calendar-outline" size={16} color={C.accent} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={goToNext}
        disabled={!canGoNext}
        style={[s.navBtn, !canGoNext && s.navBtnDisabled]}
      >
        <Ionicons name="chevron-forward" size={20} color={C.sub} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 16, padding: 12, marginBottom: 12, gap: 4,
  },
  navBtn: { padding: 4 },
  navBtnDisabled: { opacity: 0.3 },
  center: { flex: 1, alignItems: 'center' },
  range: { fontSize: 14, fontWeight: '700', color: C.text },
  payText: { fontSize: 11, fontWeight: '600', color: C.sub, marginTop: 2 },
  calBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
});
```

- [ ] **6.2 Modify `src/screens/owner-op/OwnerOpDashboard.tsx`.** Six edits.

Edit A — imports. Before:
```ts
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
```
After:
```ts
import { useWeek } from '../../context/WeekContext';
```
Before:
```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../../types';
import { addWeeks } from '../../utils/weekKey';
import { buildInsight, InsightKind, WeekData } from '../../utils/insights';
import { InsightsSheet } from '../../components/InsightsSheet';
import { NameEditModal } from '../../components/NameEditModal';
```
After:
```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../../types';
import { addPeriods, periodCalcOpts } from '../../utils/payPeriods';
import { buildInsight, InsightKind, WeekData } from '../../utils/insights';
import { InsightsSheet } from '../../components/InsightsSheet';
import { NameEditModal } from '../../components/NameEditModal';
import { PeriodBar } from '../../components/PeriodBar';
import { PayScheduleBanner } from '../../components/PayScheduleBanner';
import { PayScheduleModal } from '../PayScheduleScreen';
```

Edit B — hook + state. Before:
```ts
  const { weekKey, goToPrev, goToNext, canGoPrev, canGoNext } = useWeek();
  const [loads, setLoads] = useState<LoadEntry[]>([]);
```
After:
```ts
  const { weekKey, period, schedule, needsSetup, reloadSchedule } = useWeek();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [loads, setLoads] = useState<LoadEntry[]>([]);
```

Edit C — previous period key inside `useFocusEffect`. Before:
```ts
    useCallback(() => {
      const prevKey = addWeeks(weekKey, -1);
```
After:
```ts
    useCallback(() => {
      const prevKey = addPeriods(weekKey, -1, schedule);
```
and the dependency array at the bottom of the same `useCallback`. Before:
```ts
    }, [weekKey])
```
After:
```ts
    }, [weekKey, schedule])
```

Edit D — summary uses the period. Before:
```ts
  const mileageOn = driverType !== 'owner-op';
  const summary = calcOwnerOpSummary(loads, expenses, fuelEntries, { mileage: mileageOn });
```
After:
```ts
  const mileageOn = driverType !== 'owner-op';
  const calcPeriod = periodCalcOpts(period, schedule);
  const summary = calcOwnerOpSummary(loads, expenses, fuelEntries, { mileage: mileageOn, period: calcPeriod });
```

Edit E — replace the week-nav card with banner + PeriodBar. Before:
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
After:
```tsx
        <PayScheduleBanner onOpen={() => setScheduleOpen(true)} />
        <PeriodBar onOpenSchedule={() => setScheduleOpen(true)} />
```
(Leave the now-unused `weekNavCard`/`navBtn`/`navBtnDisabled`/`weekLabel` styles in place or delete them — deleting is preferred; if deleted, remove all four style entries.)

Edit F — insight opts + modal mount. Before:
```tsx
      <InsightsSheet
        insight={
          openInsight
            ? buildInsight(openInsight, { loads, expenses, fuelEntries }, prevWeek, { mileage: mileageOn })
            : null
        }
        onClose={() => setOpenInsight(null)}
      />
```
After:
```tsx
      <InsightsSheet
        insight={
          openInsight
            ? buildInsight(openInsight, { loads, expenses, fuelEntries }, prevWeek, { mileage: mileageOn, period: calcPeriod })
            : null
        }
        onClose={() => setOpenInsight(null)}
      />
      <PayScheduleModal
        visible={scheduleOpen}
        initialSchedule={needsSetup ? null : schedule}
        onClose={() => setScheduleOpen(false)}
        onSaved={reloadSchedule}
      />
```

- [ ] **6.3 Modify `src/screens/company-mile/CompanyMileDashboard.tsx`.** Four edits.

Edit A — imports. Before:
```ts
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
```
After:
```ts
import { useWeek } from '../../context/WeekContext';
import { PeriodBar } from '../../components/PeriodBar';
import { PayScheduleBanner } from '../../components/PayScheduleBanner';
import { PayScheduleModal } from '../PayScheduleScreen';
```

Edit B — hook + state. Before:
```ts
  const { weekKey, goToPrev, goToNext, canGoPrev, canGoNext } = useWeek();
  const [loads, setLoads] = useState<LoadEntry[]>([]);
```
After:
```ts
  const { weekKey, schedule, needsSetup, reloadSchedule } = useWeek();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [loads, setLoads] = useState<LoadEntry[]>([]);
```

Edit C — replace the week-nav card. Before:
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
After:
```tsx
        <PayScheduleBanner onOpen={() => setScheduleOpen(true)} />
        <PeriodBar onOpenSchedule={() => setScheduleOpen(true)} />
```

Edit D — mount the modal directly after the existing `<NameEditModal … />` element (still inside the root `<View style={s.root}>`):
```tsx
      <PayScheduleModal
        visible={scheduleOpen}
        initialSchedule={needsSetup ? null : schedule}
        onClose={() => setScheduleOpen(false)}
        onSaved={reloadSchedule}
      />
```
(As in 6.2, the orphaned `weekNavCard`/`navBtn`/`navBtnDisabled`/`weekLabel` styles should be deleted.)

- [ ] **6.4 Modify `src/screens/company-commission/CompanyCommissionDashboard.tsx`** — apply exactly the same four edits as 6.3 (the file is structurally identical; the `useWeek` destructure, week-nav card block, and `NameEditModal` anchor match byte-for-byte).

- [ ] **6.5 Modify `src/screens/owner-op/OwnerOpHistory.tsx`.** Four edits.

Edit A — imports. Before:
```ts
import { calcOwnerOpSummary } from '../../utils/calculations';
import { formatWeekDisplay } from '../../context/WeekContext';
```
After:
```ts
import { calcOwnerOpSummary } from '../../utils/calculations';
import { useWeek } from '../../context/WeekContext';
import { getPeriod, periodCalcOpts, formatPeriodDisplay, formatPayDate } from '../../utils/payPeriods';
```

Edit B — hook. Before:
```ts
  const driverType: string = route?.params?.driverType ?? 'owner-op';
  const mileageOn = driverType !== 'owner-op';
```
After:
```ts
  const driverType: string = route?.params?.driverType ?? 'owner-op';
  const mileageOn = driverType !== 'owner-op';
  const { schedule } = useWeek();
```

Edit C — summary uses the re-derived period. Before:
```ts
    const summary = calcOwnerOpSummary(
      loads,
      expenses ?? { ...EMPTY_EXPENSES, weekKey },
      fuelEntries,
      { mileage: mileageOn }
    );
```
After:
```ts
    const summary = calcOwnerOpSummary(
      loads,
      expenses ?? { ...EMPTY_EXPENSES, weekKey },
      fuelEntries,
      { mileage: mileageOn, period: periodCalcOpts(getPeriod(weekKey, schedule), schedule) }
    );
```

Edit D — row label + pay date. Before:
```tsx
              <View style={s.weekLabelBox}>
                <Text style={s.weekLabel}>{formatWeekDisplay(wk)}</Text>
                <Text style={s.weekSub}>
                  {expanded === wk && weekData[wk]
                    ? `${weekData[wk].loads.length} load${weekData[wk].loads.length !== 1 ? 's' : ''}`
                    : 'Tap to expand'}
                </Text>
              </View>
```
After:
```tsx
              <View style={s.weekLabelBox}>
                <Text style={s.weekLabel}>{formatPeriodDisplay(getPeriod(wk, schedule))}</Text>
                <Text style={s.weekSub}>
                  {expanded === wk && weekData[wk]
                    ? `${weekData[wk].loads.length} load${weekData[wk].loads.length !== 1 ? 's' : ''} · pay day ${formatPayDate(getPeriod(wk, schedule))}`
                    : `Pay day ${formatPayDate(getPeriod(wk, schedule))}`}
                </Text>
              </View>
```

- [ ] **6.6 Modify `src/screens/company-mile/CompanyMileHistory.tsx`.** Three edits.

Edit A — imports. Before:
```ts
import { formatWeekDisplay } from '../../context/WeekContext';
```
After:
```ts
import { useWeek } from '../../context/WeekContext';
import { getPeriod, formatPeriodDisplay, formatPayDate } from '../../utils/payPeriods';
```

Edit B — hook, first line of the component body. Before:
```ts
export function CompanyMileHistory({ navigation }: Props) {
  const [weeks, setWeeks] = useState<string[]>([]);
```
After:
```ts
export function CompanyMileHistory({ navigation }: Props) {
  const { schedule } = useWeek();
  const [weeks, setWeeks] = useState<string[]>([]);
```

Edit C — row label + pay date. Before:
```tsx
              <View style={s.weekLabelBox}>
                <Text style={s.weekLabel}>{formatWeekDisplay(wk)}</Text>
                <Text style={s.weekSub}>
                  {expanded === wk && weekData[wk]
                    ? `${weekData[wk].loads.length} load${weekData[wk].loads.length !== 1 ? 's' : ''}`
                    : 'Tap to expand'}
                </Text>
              </View>
```
After:
```tsx
              <View style={s.weekLabelBox}>
                <Text style={s.weekLabel}>{formatPeriodDisplay(getPeriod(wk, schedule))}</Text>
                <Text style={s.weekSub}>
                  {expanded === wk && weekData[wk]
                    ? `${weekData[wk].loads.length} load${weekData[wk].loads.length !== 1 ? 's' : ''} · pay day ${formatPayDate(getPeriod(wk, schedule))}`
                    : `Pay day ${formatPayDate(getPeriod(wk, schedule))}`}
                </Text>
              </View>
```

- [ ] **6.7 Modify `src/screens/company-commission/CompanyCommissionHistory.tsx`** — apply exactly the same three edits as 6.6 (the file mirrors CompanyMileHistory; adjust only the component name in Edit B's anchor: `export function CompanyCommissionHistory(`).

- [ ] **6.8 Run:** `npx tsc --noEmit` → clean (this catches any leftover `formatWeekDisplay` / `addWeeks` references). `npm test` → green.

- [ ] **6.9 Commit:**
```
git add src/components/PeriodBar.tsx src/screens/owner-op/OwnerOpDashboard.tsx src/screens/company-mile/CompanyMileDashboard.tsx src/screens/company-commission/CompanyCommissionDashboard.tsx src/screens/owner-op/OwnerOpHistory.tsx src/screens/company-mile/CompanyMileHistory.tsx src/screens/company-commission/CompanyCommissionHistory.tsx
git commit -m "feat: period bar + schedule editor entry on dashboards; period-aware History"
```

---

## Controller-only follow-ups (NOT for task workers)

- [ ] **Apply schema-v6 to the live database BEFORE merging** `feat/pay-schedule` (signup inserts reference the new columns). Use the Supabase Management API with the `sbp_...` token (see project `.env` / memory note), project ref `wuegzljzxnacssxzxfsh`:
  ```
  POST https://api.supabase.com/v1/projects/wuegzljzxnacssxzxfsh/database/query
  body: {"query": "alter table profiles add column if not exists schedule_start_date date; alter table profiles add column if not exists schedule_frequency text not null default 'weekly'; alter table profiles add column if not exists schedule_pay_day int not null default 5;"}
  ```
  Verify with a follow-up query: `select column_name from information_schema.columns where table_name = 'profiles' and column_name like 'schedule%';` (expect 3 rows). Note: the free tier pauses — if the API returns "Network request failed"-style errors, restore the project first.
- [ ] **Final review:** run superpowers:requesting-code-review against the spec; confirm `npx tsc --noEmit` and `npm test` (full suite) on the merged branch.
- [ ] **Builds / manual pass:** `npx expo start`, run the manual test checklist below in Expo Go, then cut the preview APK.

## Task ordering / parallel lanes

- **Task 1 first** — everything else consumes its types or functions.
- **Lane A (after Task 1): Task 2** — touches only `src/utils/calculations.ts`, `src/utils/insights.ts`, `__tests__/calculations.test.ts`.
- **Lane B (after Task 1): Task 3** — touches only `src/sync/*`, `src/storage/storage.ts`, `src/supabase/schema-v6.sql`, and the storage/sync/migration test files. Lanes A and B share **no files** and can run in parallel.
- **Task 4 after Tasks 1 + 3** (imports `getSchedule` from storage). Touches only `src/context/WeekContext.tsx`.
- **Task 5 after Tasks 1 + 3 + 4** (uses storage helpers and `useWeek().needsSetup`). Touches `src/screens/PayScheduleScreen.tsx`, `src/components/PayScheduleBanner.tsx`, `src/screens/SignupScreen.tsx`, `App.tsx`.
- **Task 6 last** (after 1, 2, 4, 5) — the only task touching dashboards/History, so it never conflicts with the others.
- File-overlap summary: `src/types/index.ts` is written only by Task 1; no two tasks modify the same file.

## Manual test checklist (Expo Go / preview APK)

- [ ] **Signup with schedule:** create a new account, expand the Pay schedule section, pick bi-weekly + a mid-week start date + pay day Fri → after landing, the dashboard period bar shows a 14-day range and the correct "Pay day Fri, …"; the Supabase `profiles` row has the three `schedule_*` values.
- [ ] **Signup skipping the section:** defaults apply — dashboard behaves exactly like today (Mon–Sun week, pay day Friday shown).
- [ ] **Existing account, first login after update:** dashboard shows the "Set your pay schedule" banner; the app is fully usable behind it (weekly defaults). Dismiss → banner never returns (including after app restart). Alternatively "Set up" → save a schedule → banner gone, bar updates.
- [ ] **Each frequency:** switch the schedule between weekly / bi-weekly / monthly via the bar's calendar icon; for each: the range renders correctly, prev/next steps by exactly one period, back-navigation stops at the start period, forward stops one period ahead of today, and the pay date matches the rules (first pay-day weekday strictly after the end; monthly = payDay of next month, "Last day" clamps on 30/28-day months).
- [ ] **Future start date:** set startDate next month → dashboard opens on that first period; only one forward step allowed.
- [ ] **Expense conversion sanity (owner-op/lease, bi-weekly):** a $100/weekly recurring expense contributes $200 to the period; a $433/monthly expense contributes ≈$200; a daily expense multiplies by 14; the Expenses insight rows show "per period" subs; on a weekly schedule the numbers and subs are identical to the pre-feature app.
- [ ] **History:** with a bi-weekly schedule, old weekly entries group under re-derived 14-day ranges with pay dates (accepted v1 behavior; note shown on the edit screen). Deleting weeks/loads from History still works.
- [ ] **Sync round-trip:** edit the schedule on device A, sign in on device B → B pulls the same schedule (period bar matches). Airplane-mode edit syncs when back online (queue drains).
- [ ] **Sign-out/in:** `wipeAll` clears the schedule; re-login pulls it back from `profiles`.

## Spec self-review (verified before finalizing this plan)

- §1 schedule shape/defaults/storage → Tasks 1 (types, `defaultSchedule`), 3 (`profile:schedule`, columns). ✓
- §2 engine functions + rules → Task 1 (all six spec functions plus `defaultSchedule`/`periodDays`/`periodCalcOpts` helpers; UTC math; weekly = `getWeekKey`). ✓
- §3 context/navigation/clamps, names kept, `formatWeekDisplay` retained → Task 4. ✓
- §4 PayScheduleScreen, signup inline form, first-login banner, dashboards bar + calendar icon, edit-screen note, History ranges + pay dates → Tasks 5, 6. ✓
- §5 `toPeriod` formulas, `opts.period`, insights threading, per-period sub-labels, weekly byte-identical, company summaries untouched → Task 2. ✓
- §6 schema-v6 verbatim, `saveSchedule` local+enqueue, pull mapping, NULL = banner case → Task 3; live-DB apply → controller follow-ups. ✓
- §7 async-load default, future start, clamping, frequency-change note, biweekly parity → Tasks 1, 4, 5 + tests. ✓
- §8 test matrix → Tasks 1–3 test steps + manual checklist. ✓
