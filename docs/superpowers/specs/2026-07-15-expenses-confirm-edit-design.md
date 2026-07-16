# Expenses Screen: Confirm/Edit/Delete Fields + Repeatable Other Expenses — Design Spec

**Date:** 2026-07-15
**Scope:** Owner-Op/Lease Expenses screen (`OwnerOpWeeklyExpenses.tsx`) + the data model, sync, calculations, and insights that consume `WeeklyExpenses`. Loads and Fuel screens unchanged (they already have add/edit/delete flows).

## Problem

1. Amount fields are plain always-editable text inputs. Nothing confirms an entry; a stray tap opens the keyboard on a value the user meant to keep; the only persistence is one big "Save Expenses" button that's easy to forget.
2. "Other" is a single number. Real weeks have several one-off expenses (truck wash, parts, tolls…) that can't be tracked separately.

## Solution overview

Every number field becomes a two-state **ConfirmedAmountField**; confirmed values save to AsyncStorage immediately (auto-enqueueing the existing sync op), and the master "Save Expenses" button is removed. "Other" becomes an unlimited list of named entries stored in a new `otherExpenses` array, persisted to Supabase as a JSONB column on the existing `weekly_expenses` row.

## Field behavior (`ConfirmedAmountField`)

Two states per field:

- **Locked** (has a saved value > 0): renders label, formatted amount, W/M badge (expense fields only), and inline **pencil** (edit) and **trash** (delete) icons. Tapping the row body does NOT open the keyboard.
- **Editing** (no saved value, or after tapping pencil): numeric input (decimal-pad; `$` prefix for money fields, none for odometers), frequency toggle (expense fields only), a yellow **✓ confirm** button, and a **✗ cancel** button (only when editing an existing value; reverts to the previous value).

Rules:
- ✓ confirm parses the input (`parseFloat || 0`), writes the full `WeeklyExpenses` to storage via `saveWeeklyExpenses` (which enqueues the sync op), and switches the field to Locked. Confirming 0/empty returns the field to the empty Editing state.
- Trash shows one `Alert.alert` confirm ("Remove <label>?" / Cancel / Remove). On confirm: fixed fields reset to 0 (and 'weekly'), odometers reset to 0, Other entries are removed from the array entirely. Then save immediately.
- Odometers get identical treatment minus `$` prefix and frequency toggle (number-pad keyboard).
- The miles-driven/mileage-deduction calc box keeps updating from saved odometer values.
- The "Save Expenses" button is deleted. The post-save `Alert.alert('Saved', …)` is replaced by the visual state change (no popup spam on every field).

Applies to: Truck Payment, Truck Insurance, Trailer Insurance, Trailer Lease, IFTA, Admin Fee, every Other entry, Start Odometer, End Odometer.

Component definition rule applies: `ConfirmedAmountField` (and the Other-entry editor) are module-scope components in the screen file or `src/components/`.

## Repeatable Other expenses

- New type:
  ```ts
  type OtherExpense = { id: string; label: string; amount: number; frequency: Frequency };
  ```
  `id` via the app's existing uuid setup. `WeeklyExpenses` gains `otherExpenses: OtherExpense[]`.
- The single "OTHER" row is replaced by an **OTHER EXPENSES** section: a list of locked entry rows ("Truck wash · $50.00 · W" with pencil/trash) plus an **"+ Add Expense"** button that opens an inline editor: name input (required, non-empty after trim), amount, frequency, ✓ / ✗. Unlimited entries.
- Editing an entry (pencil) reopens the same inline editor prefilled.

## Legacy `other` compatibility

`other: number` / `otherFrequency` stay on the type (old synced rows and old local rows have them). Single normalization rule, applied in **one place** — a pure `normalizeExpenses(e: WeeklyExpenses): WeeklyExpenses` helper in `src/utils/calculations.ts`, called by `getWeeklyExpenses` in storage on read:

- If `otherExpenses` is missing/undefined → set `[]`.
- If legacy `other > 0` AND `otherExpenses` is empty → convert to one entry `{ id: 'legacy-other', label: 'Other', amount: other, frequency: otherFrequency ?? 'weekly' }` and zero out `other`.
- Never double-count: after normalization, consumers read ONLY `otherExpenses`; `calcOwnerOpSummary` and `insights.ts` ignore the legacy field (they receive normalized objects; `calcOwnerOpSummary` also calls `normalizeExpenses` defensively since tests construct raw objects).

On save, the screen always writes `other: 0, otherFrequency: 'weekly'` plus the real `otherExpenses` array — so once a user touches a week, it's migrated.

## Data layer

- **Storage** (`storage.ts`): `getWeeklyExpenses` returns normalized objects. Supabase pull mapping reads `row.other_expenses ?? []`.
- **Sync** (`syncEngine.ts`): `upsertExpenses` payload adds `other_expenses: e.otherExpenses` (JSONB). No new op types.
- **Migration** (`migration.ts`): unchanged — it round-trips whole `WeeklyExpenses` objects.
- **Supabase**: `src/supabase/schema-v3.sql`:
  ```sql
  alter table weekly_expenses add column if not exists other_expenses jsonb not null default '[]'::jsonb;
  ```
  Must be applied to the project (ref `wuegzljzxnacssxzxfsh`) before the new client syncs; the project must be restored from pause first. Old clients ignore the column; new clients tolerate its absence in reads (`?? []`) but writes will fail until applied — acceptable since the sync queue retries.

## Ripple updates

- `calculations.ts` — `calcOwnerOpSummary` sums `otherExpenses` with the same `toWeekly` conversion, replacing the legacy `other` term (via normalization).
- `insights.ts` — the Expenses breakdown replaces the single "Other" row with one row per entry, labeled by the entry's name (sub shows % of total + "monthly ÷ 4.33" when applicable). `hasData` counts non-empty `otherExpenses`.
- `OwnerOpDashboard.tsx` — `EMPTY_EXPENSES` gains `otherExpenses: []`.
- Test fixtures across `__tests__/` gain `otherExpenses: []` where they build `WeeklyExpenses`.

## Error handling

- Empty/invalid amount on ✓ → treated as 0 → field returns to empty state (no error popup).
- Add-Expense ✓ with empty name → inline red hint "Name required", not saved.
- Storage save failures are already surfaced by the existing sync status badge; no new handling.

## Testing

- `calculations.test.ts` additions: multiple `otherExpenses` (weekly + monthly mix) summed correctly; legacy `other` normalized without double counting; empty list.
- `insights.test.ts` additions: named Other rows appear individually with correct % subs; legacy fallback shows one "Other" row.
- New `normalizeExpenses` unit tests: legacy conversion, already-migrated passthrough, missing-field default.
- Screen behavior verified manually (Expo Go): confirm-lock cycle, edit, delete with alert, add/edit/delete Other entries, odometers, instant persistence across tab switches.
