# Company Modes Parity — Design Spec

**Date:** 2026-07-18
**Scope:** Bring both company driver modes (per-mile and commission) up to the owner-op UX: structured locations, confirmed amount fields, and the driver/company name in the dashboard header. Reuses existing components; no data-model or schema changes.

## 1. Add Load — structured locations (both company screens)

- `CompanyMileAddLoad.tsx` and `CompanyCommissionAddLoad.tsx` replace the two free-text location inputs with four fields, exactly like `OwnerOpAddLoad`:
  - STARTING CITY (TextInput) + STARTING STATE (`<StatePicker>`), ENDING CITY + ENDING STATE.
  - On edit, `splitCityState(editLoad.startLocation/endLocation)` prefills city+state; unknown tails land wholly in city with state unselected.
  - On save, `joinCityState(city, state)` composes the stored string — persisted format stays `"City, ST"`; no storage/sync changes.
  - Validation: city non-empty AND state selected for both ends (alert: "Please enter city and select a state for both start and end.").
- Components/helpers reused from `src/components/StatePicker.tsx` and `src/utils/usStates.ts` — nothing new is created.

## 2. Add Load — confirmed amount fields

- **Per-mile:** PAID MILEAGE becomes `<ConfirmedAmountField money={false} placeholder="e.g. 500">`; RATE ($ PER MILE) becomes `<ConfirmedAmountField placeholder="0.55">` (money, no frequency). Both hold local numeric state (`paidMileage`, `centsPerMile` as numbers, 0 = empty); Save Load persists. Field keys `${field}:${editLoad?.id ?? 'new'}:${weekKey}` for week/edit remount (same convention as owner-op AddLoad).
  - "Load Earnings" preview box shows when both values > 0: `paidMileage × centsPerMile`.
  - Save validation: locations (per §1) + `paidMileage > 0` + `centsPerMile > 0`.
- **Commission:** the EARNINGS field becomes a `<ConfirmedAmountField>` (same as owner-op earnings). `CommissionSelector` and its preview box unchanged. Save validation: locations + `earnings > 0` + commission rate selected. (Commission mode has no TONU concept — unchanged.)

## 3. Dashboard header — name as title (both company dashboards)

- `CompanyMileDashboard.tsx` and `CompanyCommissionDashboard.tsx`:
  - `ScreenHeader title={driverName || fallback} subtitle="Driver dashboard" onPress={handleEditName}` where fallback is the current mode title ("Company Per Mile" / "Company Commission"); when no name is set the subtitle reads "Tap to add name" instead of "Driver dashboard".
  - `driverName` loaded via `getProfileName()` in the focus effect; `handleEditName` is the same `Alert.prompt` + `saveProfileName` flow as `OwnerOpDashboard.handleEditName`.
  - Right slot (SyncStatusBadge + SignOutButton) unchanged.
- Signup already writes the name to `profiles.name` and pull stores it locally, so new accounts show their name with zero extra work.

## Out of scope / unchanged

History screens, week navigation, calculations, sync engine, Supabase schema, owner-op/lease screens, tab structure.

## Error handling

- State parse failure on load edit → whole string into city, state unselected (existing `splitCityState` behavior).
- Confirmed field cleared (trash) → value 0, Save blocks with the missing-fields alert.
- Empty name prompt result → name cleared, header falls back to mode title + "Tap to add name".

## Testing

- No new pure logic (all reused helpers already unit-tested: usStates, ConfirmedAmountField conventions). Suite must stay green (94 tests) and `tsc --noEmit` clean.
- Manual (preview APK): per-mile and commission — add load with city/state + confirmed fields; edit legacy `"City, ST"` and free-text loads; earnings preview; name shows as header title on both dashboards, tap-to-edit works, fallback when empty.
