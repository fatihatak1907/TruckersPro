# Daily Frequency for Other Expenses + Confirm Fields on Add Load — Design Spec

**Date:** 2026-07-16
**Scope:** `OtherExpense` frequency options; Owner-Op/Lease Add Load screen. Fixed expense fields keep W/M; company Add Load screens unchanged.

## Problem

1. Other expenses only support weekly/monthly, but some costs are daily (parking, per-day fees).
2. Add Load's earnings and TONU fields are plain inputs — no confirm/lock/edit affordance, inconsistent with the reworked Expenses screen.

## Solution overview

### Daily frequency (Other expenses only)

- New type in `src/types/index.ts`:
  ```ts
  export type OtherFrequency = 'daily' | 'weekly' | 'monthly';
  ```
  `OtherExpense.frequency` becomes `OtherFrequency`. The global `Frequency` type (`'weekly' | 'monthly'`) and all six fixed `*Frequency` fields are unchanged.
- Conversion: **daily → weekly is amount × 7**; monthly stays ÷ 4.33. The shared `toWeekly` helper in `src/utils/calculations.ts` widens its `freq` parameter to `OtherFrequency | undefined` and adds the daily case. Fixed fields never pass `'daily'`, so their behavior is untouched.
- `normalizeExpenses` unchanged (legacy conversion still produces `'weekly' | 'monthly'`, both valid `OtherFrequency` values).
- UI: the Other-entry editor's frequency toggle shows **D / W / M**; locked entry rows show a `D` badge for daily. The `FreqToggle` component becomes generic over its option list (`options: readonly F[]` + label map) so the fixed fields keep rendering only W/M.
- Insights: the expense-row sub-label logic gains `daily × 7` (analogous to `monthly ÷ 4.33`).
- Supabase: no schema change — entries serialize into the existing `other_expenses` JSONB column.

### Confirm/lock on Add Load (owner-op/lease)

- Extract `ConfirmedAmountField` (and its generic `FreqToggle`) from `OwnerOpWeeklyExpenses.tsx` into `src/components/ConfirmedAmountField.tsx` with **zero behavior change** for the Expenses screen. Its contract already delegates persistence to the parent via `onCommit`/`onDelete`.
- In `OwnerOpAddLoad.tsx`, EARNINGS ($) and TONU ($) become `ConfirmedAmountField`s (money, no frequency):
  - ✓ confirm updates **local component state only** (`earnings`/`tonu` numbers) and locks the field with the green check + pencil/trash.
  - Trash (with the standard confirm alert) clears the value to 0 → field returns to the empty input state.
  - **Nothing is persisted until "Save Load" / "Update Load"** — `handleSave` validation and `saveLoad` flow are unchanged (TONU-only saves still allowed; missing-fields alerts unchanged).
  - Editing an existing load prefetches values as locked fields. Fields remount per `editLoad?.id` and week (React keys) so drafts never leak between loads/weeks.
  - Locations and CommissionSelector are untouched.
- State migration in the screen: `earnings`/`tonu` change from `string` state to `number` state (0 = empty); `commissionAmount` preview derives from the numeric value.

## Error handling

- Unconfirmed (still-typing) drafts in earnings/TONU are NOT included in the saved load — the ✓ is the only way a value enters screen state. `handleSave` while a draft is pending simply validates against the last confirmed values (a visible-but-unconfirmed draft is the user's signal to confirm first; no extra guard).
- Daily entries with the legacy pipeline: not possible — legacy `other` rows normalize to weekly/monthly only.

## Testing

- `__tests__/expenses.test.ts`: daily entry ×7 in `calcOwnerOpSummary` (e.g. $10 daily → $70 weekly); mixed D/W/M list sums correctly.
- `__tests__/insights.test.ts`: daily entry row sub contains `daily × 7`, value shows the weekly-ized amount.
- All existing suites stay green (extraction is behavior-neutral; only the 3 documented pre-existing `calculations.test.ts` failures may fail).
- Manual (Expo Go): D/W/M toggle on Other editor; D badge on locked row; Add Load confirm-lock cycle for earnings/TONU; TONU-only save; edit-load prefill locked; Save Load unchanged.
