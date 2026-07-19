# Pay Schedule (Configurable Working Periods + Pay Dates) — Design Spec

**Date:** 2026-07-18
**Scope:** Replace the hard-coded Monday-week rhythm with a per-driver pay schedule (start date, payment frequency, pay day) for ALL four driver types. Additive data model; existing weekly users see zero change until they opt into other options.

## 1. The schedule (per driver)

`PaySchedule` = `{ startDate: string /* YYYY-MM-DD, any date */, frequency: 'weekly' | 'biweekly' | 'monthly', payDay: number }`

- `payDay` semantics: weekly/biweekly → weekday 1–7 (1 = Monday … 7 = Sunday); monthly → day of month 1–28 or 31 meaning "last day of month".
- Default schedule (existing users and anyone who skips setup): `{ startDate: <their first period start / today>, frequency: 'weekly', payDay: 5 /* Friday */ }`.
- Stored locally (`profile:schedule` JSON) and synced to `profiles` (columns `schedule_start_date date`, `schedule_frequency text not null default 'weekly'`, `schedule_pay_day int not null default 5` — schema-v6, additive, applied to live DB before merge).

## 2. Period engine (`src/utils/payPeriods.ts` — pure, heavily tested)

Core type: `PayPeriod = { key: string /* YYYY-MM-DD of period start */, start: string, end: string /* inclusive */, payDate: string }`.

Functions:
- `periodForDate(date: string, schedule): PayPeriod` — the period containing `date`.
- `addPeriods(key: string, delta: number, schedule): string` — step period keys.
- `getPeriod(key: string, schedule): PayPeriod` — full period record for a key.
- `firstPeriod(schedule): PayPeriod` — the period containing `startDate` (navigation floor).
- `formatPeriodDisplay(period): string` — "Jul 13 – Jul 26".
- `formatPayDate(period): string` — "Fri, Jul 31".

Rules:
- **weekly**: Monday–Sunday, 7 days (identical boundaries to today's `getWeekKey`).
- **biweekly**: 14 days, Monday–Sunday ×2, anchored to the Monday of the week containing `startDate` (all later periods derive from that anchor; dates before the anchor extend the lattice backward consistently).
- **monthly**: true calendar months (1st → last day; Feb 28/29, leap years correct). All date math in UTC (same convention as `weekKey.ts`).
- **payDate**: weekly/biweekly → the first `payDay` weekday strictly AFTER the period's end. monthly → `payDay` of the FOLLOWING month, clamped to that month's last day (31 ⇒ always last day).
- Period keys remain `YYYY-MM-DD` of the period start — for weekly this is byte-identical to today's week keys, so **existing stored data needs no migration**.

## 3. Context + navigation

- `WeekContext` evolves into the period provider (file name and `useWeek()`/`weekKey` names kept to minimize churn; `weekKey` now means "current period key"). It loads the schedule from storage at mount (async; defaults to weekly until loaded), exposes: `weekKey`, `period: PayPeriod`, `schedule`, `reloadSchedule()`, `canGoPrev`, `canGoNext`, `goToPrev`, `goToNext`.
- Clamps: floor = `firstPeriod(schedule)` (replaces the home-week floor — a driver can navigate back to their start period, matching "history begins at the start date"); ceiling = one period ahead of the period containing today.
- `formatWeekDisplay(weekKey)` remains for History fallbacks; new period-aware formatting comes from the context's `period`.

## 4. UI

- **PayScheduleScreen** (`src/screens/PayScheduleScreen.tsx`): start-date calendar picker (custom month-grid modal, no new deps), frequency pills (Weekly / Bi-weekly / Monthly), pay-day picker (weekday row, or day-of-month grid + "Last day" for monthly), live preview line ("Periods: Jul 13 – Jul 26 · first pay day Fri, Jul 31"), Save.
- **Signup**: after driver-type selection, the same schedule form appears inline (collapsed section) with defaults prefilled; schedule saves with the profile (metadata for confirm-flow users, direct insert otherwise).
- **First login for existing accounts**: if the profile has no `schedule_start_date`, dashboards show a one-time banner "Set your pay schedule" opening PayScheduleScreen; dismiss = keep weekly defaults (banner never blocks usage).
- **Dashboards (all 4 types)**: period bar shows the range + "Pay day <Fri, Jul 31>"; a small calendar icon in the bar opens PayScheduleScreen for edits. Edit screen carries the note: "Past periods stay as recorded; new periods follow the new schedule."
- **History (all types)**: rows render each stored key's range using the current schedule (`getPeriod(key)`) and its pay date.

## 5. Money math

`calcOwnerOpSummary(..., opts?: { mileage?: boolean; period?: { days: number; isMonth: boolean } })` (default `{days: 7, isMonth: false}` — fully back-compatible). Recurring conversion `toPeriod(amount, freq, period)`:
- `once` → amount
- `daily` → amount × period.days
- `weekly` → amount × (period.days / 7)
- `monthly` → period.isMonth ? amount : amount × (period.days / 7) / 4.33

(Weekly periods therefore produce exactly today's numbers — existing tests keep passing.) Insights receive the same `period` option; expense sub-labels: keep current notes for weekly periods; for other periods show `per period` on converted rows. Company summaries are load-sums only — unaffected.

## 6. Sync / schema

- schema-v6.sql: `alter table profiles add column if not exists schedule_start_date date; alter table profiles add column if not exists schedule_frequency text not null default 'weekly'; alter table profiles add column if not exists schedule_pay_day int not null default 5;`
- `saveSchedule()` writes local + enqueues profile upsert (extend `upsertProfile` payload); `pullFromSupabase` maps the three columns into `profile:schedule`.
- Old clients ignore the columns entirely (safe); new clients treat missing/NULL `schedule_start_date` as "not set up" (banner case) while defaulting behavior to weekly.

## 7. Error handling / edge cases

- Schedule not yet loaded at mount → provider defaults to weekly/current week; screens render normally and re-render when loaded.
- Start date in the future → first period lies ahead; dashboard opens on it; ceiling = first period + 1.
- Pay day 31 in a 30/28-day month → clamped to last day. Feb 29 handling via real Date math (UTC).
- Frequency change with existing data: keys stay; History may show old entries grouped under re-derived ranges — accepted v1 behavior, noted in the edit screen.
- Biweekly parity: `addPeriods`/`periodForDate` must agree on the anchor lattice for dates both before and after `startDate`.

## 8. Testing

- `__tests__/payPeriods.test.ts` — the heaviest suite: all three frequencies; start dates on all 7 weekdays; leap year (Feb 2028); Dec→Jan boundaries; monthly pay day 31→clamp; biweekly anchor parity (periodForDate(addPeriods(k, ±n)) round-trips); weekly keys byte-equal to `getWeekKey`.
- calculations: `toPeriod` conversions for all four frequencies × {7, 14, month} periods; weekly stays byte-identical to current expectations.
- Existing suite (98) stays green untouched where weekly defaults apply.
- Manual (preview APK): signup with schedule; existing-account banner; each frequency's bar/nav/pay date; expense conversion sanity on bi-weekly.
