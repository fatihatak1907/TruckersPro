# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo Version

This project uses **Expo SDK 54** (not 56). Always read docs at https://docs.expo.dev/versions/v54.0.0/ before writing Expo-specific code.

## Commands

```bash
# Start dev server (read QR code with Expo Go on device)
npx expo start

# If Metro fails with ENOENT on hermes-estree/dist, run this fix then restart:
mkdir -p node_modules/@react-native/babel-preset/node_modules/hermes-estree
cp -r node_modules/hermes-estree/dist node_modules/@react-native/babel-preset/node_modules/hermes-estree/
cp node_modules/hermes-estree/package.json node_modules/@react-native/babel-preset/node_modules/hermes-estree/

# Run all tests
npm test

# Run a single test file
npx jest __tests__/calculations.test.ts

# Install packages (always use --legacy-peer-deps)
npm install <pkg> --legacy-peer-deps
```

## Architecture

**Three driver modes** share most infrastructure but have distinct data models and calculation rules:

| Mode | Key fields | Earnings formula |
|------|-----------|-----------------|
| `owner-op` | earnings, tonu, commissionRate, fuel (diesel/def), weekly expenses, odometer | earnings + tonu − commission − fuel − fixed expenses − mileage deduction ($0.14/mi) |
| `company-mile` | paidMileage, centsPerMile | paidMileage × centsPerMile |
| `company-commission` | earnings, commissionRate | earnings × commissionRate |

**Entry point**: `index.ts` → `App.tsx` (wraps `AppNavigator` in `WeekProvider`) → `src/navigation/index.tsx`.

**Week key** is always the ISO date of the Monday starting that week (`YYYY-MM-DD`). `src/utils/weekKey.ts` computes the current week key. The shared `WeekContext` (`src/context/WeekContext.tsx`) holds the active week and exposes `goToPrev` / `goToNext` / `formatWeekDisplay(weekKey)`. All screens read `weekKey` from this context — changing it on Dashboard updates all tabs immediately.

**Storage** (`src/storage/storage.ts`) wraps AsyncStorage with these key schemes:
- Loads: `loads:{driverType}:{weekKey}` → `LoadEntry[]`
- Weekly expenses (owner-op only): `expenses:owner-op:{weekKey}` → `WeeklyExpenses`
- Fuel log (owner-op only): `fuel:owner-op:{weekKey}` → `FuelEntry[]`
- Profile name: `profile:owner-op:name`

`deleteLoad` removes the entire key when the last load for a week is deleted (no empty arrays in storage). `getAllWeekKeys(driverType)` scans all AsyncStorage keys to build the history list.

**Calculations** (`src/utils/calculations.ts`) are pure functions — no side effects, no storage access. All dashboard totals are computed here.

**Navigation** (`src/navigation/index.tsx`): root Stack → three tab navigators (`OwnerOpTabs`, `CompanyMileTabs`, `CompanyCommissionTabs`). Owner-op has 5 tabs (Dashboard, AddLoad, Fuel, WeeklyExpenses, History); company modes have 3 (Dashboard, AddLoad, History). All tab screens stay mounted (React Navigation tab behavior). Add Load screens use `useFocusEffect` + `useCallback([editLoad?.id])` to reset fields on focus. After saving, always call `navigation.setParams({ load: undefined })` before navigating away to clear the edit state from route params.

**Theme** (`src/theme.ts`): all colors/shadows via `C.*` and `shadow` constants. Gradient header on every screen uses `[C.gradStart, C.gradEnd]`. Key colors: `C.accent` (green, profit), `C.danger` (red, loss), `C.gradEnd` (blue, primary).

**Shared components** (`src/components/`):
- `CurrencyInput` — `TextInput` with `$` prefix and consistent styling; prefer this over inline `inputRow` patterns
- `CommissionSelector` — pill button group for picking commission rate percentages
- `SummaryCard` — formatted key/value rows with the `fmt()` currency helper for dashboard summary displays

## Owner Op specifics

- TONU-only saves are allowed: if `tonu > 0`, earnings and commissionRate are not required (both default to `0`)
- Fuel (diesel/DEF) is logged separately in the Fuel tab (`OwnerOpFuel.tsx`), not on the Add Load form
- Monthly truck payment is divided by `4.33` to get the weekly equivalent
- Mileage deduction = `(endOdometer − startOdometer) × 0.14`

## Assets

The app logo is `Logo.jpeg` in the project root (not in `assets/`). It is referenced in `HomeScreen.tsx` as `require('../../Logo.jpeg')`. A copy also exists at `assets/logo.jpeg`.

## Component definition rule

Never define React components (functions used as `<Component />`) inside another component's function body — this causes remounting on every render and breaks `TextInput` focus. Define them at module scope, or call them as plain functions (`renderField()`) if they need closure over local state.

## Tests

Tests live in `__tests__/` and cover `calculations.ts`, `storage.ts`, and `weekKey.ts`. AsyncStorage is mocked via `jest-async-storage-mock`. The calculations tests use stale field names (`diesel`, `def` directly on `LoadEntry`) — if `LoadEntry` changes, update the test fixtures to use `FuelEntry` objects passed as the third argument to `calcOwnerOpSummary`.
