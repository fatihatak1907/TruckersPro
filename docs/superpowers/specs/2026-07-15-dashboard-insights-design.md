# Dashboard Insights — Design Spec

**Date:** 2026-07-15
**Scope:** Owner-Op / Lease dashboard only (`OwnerOpDashboard.tsx`). Company dashboards unchanged.

## Problem

1. The dashboard's "Expenses" stat already includes diesel + DEF (`calcOwnerOpSummary` sums fixed + commission + fuel), but nothing on screen makes that visible — the user couldn't tell fuel was counted.
2. The dashboard shows only totals. There is no way to see *why* a number is what it is (which loads, which expense lines, how it compares to last week).

## Solution overview

Make the Net Profit card and all six stat cards (Earnings, Expenses, Diesel, DEF, Miles, Mileage Deduction) tappable. Tapping opens a **bottom sheet** with a per-card breakdown: line items, percentages, per-mile numbers, and a comparison to the previous week.

Built with React Native's built-in `Modal` (slide animation, dim backdrop, tap-outside to close). **No new dependencies** — `@gorhom/bottom-sheet` was considered and rejected (drags in reanimated + gesture-handler, Expo Go compatibility risk, no real benefit for a breakdown list).

## Components

### `src/utils/insights.ts` (new, pure)

Same style as `calculations.ts`: pure functions, no storage, no side effects.

```ts
type InsightKind = 'net' | 'earnings' | 'expenses' | 'diesel' | 'def' | 'miles' | 'deduction';

type InsightRow = { label: string; value: string; sub?: string };

type WeekData = { loads: LoadEntry[]; expenses: WeeklyExpenses; fuelEntries: FuelEntry[] };

type Insight = {
  title: string;
  headline: string;            // the big number
  rows: InsightRow[];
  footer?: InsightRow[];       // ratios (margin %, cost/mi, % of earnings)
  change: { delta: number; pct: number } | null;  // vs last week; null = no data last week
};

function buildInsight(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null): Insight
```

Per-kind content:

| Kind | Rows | Footer |
|---|---|---|
| `net` | Waterfall: Earnings, − Expenses, − Mileage deduction, = Net | Profit margin % |
| `earnings` | One row per load (route; earnings; TONU as sub when > 0) | Earnings per mile |
| `expenses` | Every line item with weekly-ized amount — truck payment, truck/trailer insurance, trailer lease, IFTA, admin, other, commission, **Diesel**, **DEF**. Monthly items show "÷ 4.33" in sub. Each row's sub also shows % of total expenses. | % of earnings, cost per mile |
| `diesel` / `def` | One row per fuel entry (date/gallons if present; cost) | Cost per mile |
| `miles` | Start odometer, end odometer, miles driven | — |
| `deduction` | "X mi × $0.14" | — |

Rules:
- Monthly→weekly conversion identical to `calcOwnerOpSummary` (`amount / 4.33`).
- Zero-amount expense lines are omitted from rows.
- Per-mile footers are omitted when `milesDriven <= 0` (no divide-by-zero).
- `change` is `null` when last week has no loads, no fuel entries, and no expenses row — the sheet then shows "No data last week" instead of a −100% chip.

### `src/components/InsightsSheet.tsx` (new)

Module-scope component (per the component definition rule). Props: `{ insight: Insight | null; onClose: () => void }`. Renders RN `Modal` (`transparent`, `animationType="slide"`): dim backdrop (tap closes), dark card panel (`C.card`, rounded top corners, grab handle), title, headline number, rows list, footer ratios, vs-last-week chip (chip color is semantic: for cost kinds (expenses, diesel, def, deduction) an increase is red / decrease green; for net, earnings, miles the reverse — via `C.success` / `C.danger`). ScrollView inside for long row lists, max height ~75% of screen.

### `OwnerOpDashboard.tsx` (modified)

- New state: `openInsight: InsightKind | null`, `prevWeekData: WeekData | null`.
- `useFocusEffect` additionally fetches the previous week's loads/expenses/fuel using the week-key arithmetic already available in `weekKey.ts` / `WeekContext` (extract a `getPrevWeekKey(weekKey)` helper there if not already exposed).
- Net Profit card and each stat card become `TouchableOpacity` with a subtle chevron affordance; tapping sets `openInsight`.
- Renders `<InsightsSheet insight={openInsight ? buildInsight(...) : null} onClose={() => setOpenInsight(null)} />`.

## Data flow

AsyncStorage-only, no network, no schema or sync changes. Read-only presentation over existing data. Fetching the previous week adds three `get*ForWeek` calls to the existing `Promise.all`.

## Error handling

- Missing previous week → `change: null` → "No data last week" label.
- `milesDriven <= 0` → per-mile footers omitted.
- Empty loads/fuel lists → sheet shows an empty-state line ("No loads this week") instead of an empty list.

## Testing

New `__tests__/insights.test.ts` (pure functions, no mocks needed):
- Expenses breakdown includes Diesel and DEF rows and they sum into the headline total.
- Monthly frequency lines are divided by 4.33 and labeled.
- Zero-amount lines omitted.
- Percentages: row % of total, footer % of earnings, net margin.
- Per-mile math, and omission when miles = 0.
- Comparison delta/pct vs last week; `null` when last week empty.
- Earnings rows include TONU sub only when TONU > 0.

Existing tests unaffected (no changes to `calculations.ts`).
