# Lease Driver Type

## Goal
Add a "Lease" driver type with identical functionality to Owner Operator. All three driver type cards appear flat under a single "SELECT DRIVER TYPE" section on the HomeScreen (no "OTHER" sub-section).

## HomeScreen Layout

Single section: **SELECT DRIVER TYPE**
1. Owner Operator → navigates to `OwnerOp`
2. Company Driver → expandable, reveals Per Mile and Commission sub-rows (unchanged behavior)
3. Lease → navigates to `Lease`

The "OTHER" section label is removed entirely.

## Navigation

Add `LeaseTabs` stack to `src/navigation/index.tsx` with the same 5 tabs as Owner Op:
- Dashboard
- AddLoad
- Fuel
- WeeklyExpenses
- History

Each tab screen is the same component as Owner Op but receives `driverType: 'lease'` via initial route params.

Add `Lease` as a new Stack.Screen in the root navigator pointing to `LeaseTabs`.

## Storage (`src/storage/storage.ts`)

Parameterize the two hardcoded functions:
- `expensesKey(weekKey)` → `expensesKey(driverType, weekKey)` → `expenses:${driverType}:${weekKey}`
- `fuelKey(weekKey)` → `fuelKey(driverType, weekKey)` → `fuel:${driverType}:${weekKey}`
- `saveProfileName` / `getProfileName` → accept `driverType`, key becomes `profile:${driverType}:name`

All callers (Owner Op screens) updated to pass `'owner-op'`. Lease screens pass `'lease'`. Existing Owner Op data is unaffected (same keys).

Update `saveWeeklyExpenses` / `getWeeklyExpenses` / `saveFuelEntry` / `getFuelEntriesForWeek` / `deleteFuelEntry` signatures to accept `driverType`.

## Screens

All 5 Owner Op screens read `driverType` from `route.params?.driverType`, defaulting to `'owner-op'`:

| Screen | Changes |
|--------|---------|
| `OwnerOpDashboard` | Use `driverType` for all storage calls and header title |
| `OwnerOpAddLoad` | Use `driverType` on the saved `LoadEntry` and storage calls |
| `OwnerOpFuel` | Use `driverType` for fuel storage calls |
| `OwnerOpWeeklyExpenses` | Use `driverType` for expenses storage calls |
| `OwnerOpHistory` | Use `driverType` for `getAllWeekKeys` and `deleteWeekData` calls |

## Files Changed
- `src/screens/HomeScreen.tsx` — flatten layout, add Lease card
- `src/navigation/index.tsx` — add `LeaseTabs` and `Lease` stack screen
- `src/storage/storage.ts` — parameterize expenses/fuel/profile keys
- `src/screens/owner-op/OwnerOpDashboard.tsx`
- `src/screens/owner-op/OwnerOpAddLoad.tsx`
- `src/screens/owner-op/OwnerOpFuel.tsx`
- `src/screens/owner-op/OwnerOpWeeklyExpenses.tsx`
- `src/screens/owner-op/OwnerOpHistory.tsx`
