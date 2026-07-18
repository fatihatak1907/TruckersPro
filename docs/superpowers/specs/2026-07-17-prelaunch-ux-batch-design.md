# Pre-Launch UX Batch — Design Spec

**Date:** 2026-07-17
**Scope:** Nine user-requested changes before Play Store upload. Supabase config + one additive column; no destructive schema changes.

## 1. Signup: email confirmation + name field

- Supabase auth: **enable email confirmation** (Management API; requires new `sbp_` token). Simple flow (no deep link): confirmation link opens Supabase's hosted "confirmed" page; user returns to app and logs in.
- `SignupScreen`: new required **"Your name / company"** field above email. `signUp` call passes `options: { data: { driver_type, name } }` (user metadata). After signup, if `data.session` is null (confirmation pending): show a success state — "Check your email to confirm your account, then log in." with a button to Login. (If a session IS returned — confirmation disabled — the old immediate flow runs unchanged.)
- `App.tsx` bootstrap: when a logged-in user has no `profiles` row, create it from `user.user_metadata.driver_type` / `.name` before falling back to the existing `needs-profile` → `PickDriverTypeScreen` path (kept for accounts without metadata).
- Dashboard already renders `profile:name` under the title; no change needed there. Existing accounts unaffected.

## 2. Add Load: layout + structured locations

- `CommissionSelector` moves to directly under the EARNINGS field (above TONU). Commission preview box unchanged.
- Locations split: **City** (TextInput) + **State** (dropdown) for both start and end. New module-scope `StatePicker` component (`src/components/StatePicker.tsx`): a button showing the current selection that opens an RN `Modal` with a scrollable list of 56 entries — 50 states + DC + PR, GU, VI, AS, MP — each "Full Name (AB)"; tap selects and closes. Constant list `US_STATES` exported from the same file as `{ code, name }[]`.
- Persistence unchanged: `startLocation`/`endLocation` stay strings, stored as `"City, ST"`. On edit, split on the last `", "`; if the tail is a known state code, prefill city+state; otherwise put the whole string in city.
- Validation: city non-empty AND state selected for both ends (same missing-fields alert).
- Owner-op/lease AddLoad only (company AddLoad screens unchanged — same as every feature so far).

## 3. Week navigation clamps (WeekContext)

- `WeekProvider` records `homeWeek = getCurrentWeekKey()` at mount.
- `goToPrev` is a no-op when `weekKey <= homeWeek`; `goToNext` is a no-op when `weekKey >= addWeeks(homeWeek, 1)`. Context exposes `canGoPrev`/`canGoNext` booleans; the week bar chevrons render at 30% opacity when disabled.
- History tab untouched (past weeks remain visible there).

## 4. Fuel screen: dismiss keyboard on Add

- `Keyboard.dismiss()` at the top of the diesel and DEF add handlers in `OwnerOpFuel.tsx`.

## 5. One-time Other expenses

- `OtherFrequency` gains `'once'`: `'once' | 'daily' | 'weekly' | 'monthly'`.
- Math: `toWeekly(amount, 'once') === amount` — the weekly ledger is per-week, so a one-time expense counts fully in its week and nowhere else (same arithmetic as weekly; distinct label/semantics).
- UI: editor toggle becomes **1x / D / W / M** (labels: once → `1x`); locked-row badge shows `1x`; insights sub-label shows `one-time` (no conversion note). Both `toWeekly` copies (calculations, insights) handle `'once'`.
- No schema change (rides the `other_expenses` JSONB).

## 6. Mileage: remove for owner-op, custom rate for lease

- `calcOwnerOpSummary(loads, expenses, fuelEntries, opts?: { mileage?: boolean })` — when `opts.mileage === false`: `milesDriven = 0`, `mileageDeduction = 0` in the summary (netProfit = earnings − expenses). Default `true` (backwards compatible).
- **Owner-op** (`driverType === 'owner-op'`): Expenses screen hides the whole MILEAGE (ODOMETER) section; Dashboard hides the Miles and Mi. Deduct cards (4-card grid) and passes `mileage: false`; insights: `miles`/`deduction` kinds unreachable, net waterfall omits the deduction row when it's 0 and mileage is off; History summaries pass the flag too.
- **Lease**: everything stays, plus a new **MILEAGE RATE ($/MI)** confirmed field in the odometer section (money field, default 0.14, placeholder "0.14"). `WeeklyExpenses` gains `mileageRate?: number`; `mileageDeduction = milesDriven × (expenses.mileageRate ?? 0.14)`. Deduction insight row reads "X mi × $<rate>".
- Data layer: `normalizeExpenses` defaults `mileageRate` to `0.14` when absent; sync upsert adds `mileage_rate`; pull maps `row.mileage_rate ?? 0.14`; **schema-v4.sql**: `alter table weekly_expenses add column if not exists mileage_rate numeric not null default 0.14;` (additive; applied with the new token).
- Company modes: unchanged (no mileage concept).

## Order of application (user-specified)

Signup confirm → AddLoad commission reorder → week clamps → fuel keyboard → signup name (folded into #1) → one-time expense → AddLoad locations → owner-op mileage removal. Implementation may parallelize lanes with disjoint files; the final build honors all.

## Error handling

- Signup with confirmation pending: resend guidance in the success state text ("didn't get it? check spam").
- Metadata-less legacy account with no profile: existing PickDriverTypeScreen path.
- State parse failure on load edit → whole string into city, state unselected (user re-picks).
- `mileageRate` ≤ 0 or empty → treated as 0.14 default? No: confirmed 0/empty resets field to default 0.14 (a lease driver always has a rate).
- Week clamp: app open across a Monday keeps the mounted `homeWeek` until next cold start — acceptable.

## Testing

- calculations: `mileage: false` zeroes deduction; custom `mileageRate` math; `'once'` counts fully; normalize defaults `mileageRate`.
- insights: owner-op net waterfall without deduction; lease deduction row with custom rate; one-time sub-label.
- weekKey/WeekContext: clamp logic unit-tested via exported pure helper (`clampWeek(candidate, homeWeek)`).
- Location parse helper (`splitCityState`) unit-tested: "Dallas, TX" → {city, state}; "TX" → city-only; "San Juan, PR" → territory.
- Manual (preview APK): full signup→confirm→login flow; each UX change on-device.

## Supabase operations (need new sbp_ token)

1. Enable email confirmations (auth config PATCH).
2. Apply schema-v4.sql (`mileage_rate` column).
Both verified by API read-back after applying.
