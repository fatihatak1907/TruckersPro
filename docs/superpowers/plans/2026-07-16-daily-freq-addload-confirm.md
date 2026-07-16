# Daily Frequency + Add Load Confirm Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Day option (D/W/M) to Other-expense entries (daily = × 7 weekly), and give Add Load's earnings/TONU fields the same confirm/lock/edit treatment — locking locally, with the load still saved by the Save Load button.

**Architecture:** New `OtherFrequency = 'daily' | 'weekly' | 'monthly'` used only by `OtherExpense`; shared `toWeekly` gains the daily case. `ConfirmedAmountField` + a generic `FreqToggle` are extracted verbatim to `src/components/ConfirmedAmountField.tsx` and reused by Add Load with local-state-only commits. No storage/sync/schema changes (entries live in the existing JSONB column).

**Tech Stack:** React Native (Expo SDK 54), TypeScript, Jest.

**Spec:** `docs/superpowers/specs/2026-07-16-daily-freq-addload-confirm-design.md`

## Global Constraints

- No new npm dependencies.
- Daily→weekly conversion is `amount × 7`; monthly stays `amount / 4.33`. The global `Frequency` type and the six fixed `*Frequency` fields stay `'weekly' | 'monthly'` — only `OtherExpense.frequency` widens.
- Never define React components inside another component's function body.
- Screens never await the network. Add Load persists ONLY via the existing Save Load button (`saveLoad`); ✓ on its fields updates local state only.
- Type-check gate: `npx tsc --noEmit` — pre-existing errors exist ONLY in `__tests__/calculations.test.ts`, `__tests__/storage.test.ts`, `__tests__/syncEngine.test.ts`, and `src/screens/owner-op/OwnerOpAddLoad.tsx:65` (Task 4 fixes that one); no new errors allowed.
- Full suite: only the 3 documented pre-existing `calculations.test.ts` failures may fail.

---

### Task 1: `OtherFrequency` type + daily conversion in calculations

**Files:**
- Modify: `src/types/index.ts` (OtherExpense.frequency)
- Modify: `src/utils/calculations.ts` (`toWeekly`)
- Test: `__tests__/expenses.test.ts` (append)

**Interfaces:**
- Produces:

```ts
// src/types/index.ts
export type OtherFrequency = 'daily' | 'weekly' | 'monthly';
// OtherExpense.frequency: OtherFrequency  (was Frequency)

// src/utils/calculations.ts — toWeekly widens, same export surface otherwise
const toWeekly = (amount: number, freq: OtherFrequency | undefined) =>
  freq === 'monthly' ? amount / 4.33 : freq === 'daily' ? amount * 7 : amount;
```

- [ ] **Step 1: Write the failing tests** — append to `__tests__/expenses.test.ts` (reuse its existing `makeExpenses` helper):

```ts
describe('daily other expenses', () => {
  it('converts daily to weekly at ×7', () => {
    const e = makeExpenses({
      otherExpenses: [{ id: 'a', label: 'Parking', amount: 10, frequency: 'daily' }],
    });
    expect(calcOwnerOpSummary([], e).totalExpenses).toBeCloseTo(70);
  });

  it('sums a mixed D/W/M list', () => {
    const e = makeExpenses({
      otherExpenses: [
        { id: 'a', label: 'Parking', amount: 10, frequency: 'daily' },   // 70
        { id: 'b', label: 'Wash', amount: 30, frequency: 'weekly' },     // 30
        { id: 'c', label: 'Parts', amount: 433, frequency: 'monthly' },  // 100
      ],
    });
    expect(calcOwnerOpSummary([], e).totalExpenses).toBeCloseTo(200);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/expenses.test.ts`
Expected: FAIL — first on TS ('daily' not assignable to Frequency) or on math (10 counted as weekly → 40 ≠ 70... totalExpenses 10+30+100). Either failure mode is the expected RED.

- [ ] **Step 3: Implement.**

`src/types/index.ts` — add after `Frequency`:

```ts
export type OtherFrequency = 'daily' | 'weekly' | 'monthly';
```

and change `OtherExpense.frequency: Frequency;` → `frequency: OtherFrequency;`.

`src/utils/calculations.ts` — import `OtherFrequency` from `../types` and change the module-scope helper to:

```ts
const toWeekly = (amount: number, freq: OtherFrequency | undefined) =>
  freq === 'monthly' ? amount / 4.33 : freq === 'daily' ? amount * 7 : amount;
```

(`Frequency` values remain assignable — fixed-field call sites are untouched. `normalizeExpenses` unchanged.)

- [ ] **Step 4: Verify**

Run: `npx jest __tests__/expenses.test.ts __tests__/insights.test.ts` → PASS
Run: `npx tsc --noEmit` → no new errors
Run: `npm test` → only the 3 documented pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/utils/calculations.ts __tests__/expenses.test.ts
git commit -m "feat: daily frequency for other expenses (x7 weekly)"
```

---

### Task 2: insights daily sub-label

**Files:**
- Modify: `src/utils/insights.ts`
- Test: `__tests__/insights.test.ts` (append)

**Interfaces:**
- Consumes: `OtherFrequency` from `src/types`.
- Produces: expense rows for daily entries show weekly-ized value with sub containing `daily × 7`.

- [ ] **Step 1: Write the failing test** — append to `__tests__/insights.test.ts`:

```ts
describe('daily other expense in insights', () => {
  it('shows weekly-ized value with daily × 7 sub', () => {
    const w = week({
      expenses: makeExpenses({
        otherExpenses: [{ id: 'a', label: 'Parking', amount: 10, frequency: 'daily' }],
      }),
    });
    const i = buildInsight('expenses', w, null);
    const row = i.rows.find((r) => r.label === 'Parking')!;
    expect(row.value).toBe('$70.00');
    expect(row.sub).toContain('daily × 7');
    expect(i.headline).toBe('$70.00');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/insights.test.ts`
Expected: new describe FAILS (likely TS on the items array's `freq: Frequency` type, or missing sub); prior tests PASS.

- [ ] **Step 3: Implement** — in `src/utils/insights.ts`:

- Change the type import to include `OtherFrequency`:

```ts
import type { LoadEntry, WeeklyExpenses, FuelEntry, Frequency, OtherFrequency } from '../types';
```

- In `insights.ts`, widen the local `toWeekly` the same way as calculations':

```ts
const toWeekly = (amount: number, freq: OtherFrequency | undefined) =>
  freq === 'monthly' ? amount / 4.33 : freq === 'daily' ? amount * 7 : amount;
```

- In `expenseRows`, widen the items array element type from `freq: Frequency` to `freq: OtherFrequency`, and replace the sub-label line

```ts
      const monthly = i.freq === 'monthly' ? 'monthly ÷ 4.33' : '';
```

with:

```ts
      const freqNote =
        i.freq === 'monthly' ? 'monthly ÷ 4.33' : i.freq === 'daily' ? 'daily × 7' : '';
```

and use `freqNote` in the `[pct, freqNote]` join.

- [ ] **Step 4: Verify**

Run: `npx jest __tests__/insights.test.ts` → PASS
Run: `npx tsc --noEmit` → no new errors

- [ ] **Step 5: Commit**

```bash
git add src/utils/insights.ts __tests__/insights.test.ts
git commit -m "feat: daily x 7 sub-label in expenses insight"
```

---

### Task 3: extract ConfirmedAmountField + generic FreqToggle; D/W/M on Other editor

**Files:**
- Create: `src/components/ConfirmedAmountField.tsx`
- Modify: `src/screens/owner-op/OwnerOpWeeklyExpenses.tsx`

Behavior-neutral for fixed fields/odometers; Other editor gains the D option. `tsc` + full suite are the gates (UI, no unit tests by mandate).

**Interfaces:**
- Produces (consumed by Task 4 and by the expenses screen):

```ts
// src/components/ConfirmedAmountField.tsx
export function FreqToggle<F extends string>(props: {
  value: F; onChange: (v: F) => void;
  options: readonly F[]; labels: Record<F, string>;
}): JSX.Element;

export type ConfirmedAmountFieldProps = {
  label: string;
  amount: number;               // 0 = empty
  frequency?: Frequency;        // W/M toggle shown when provided
  money?: boolean;              // default true
  placeholder?: string;
  onCommit: (amount: number, frequency: Frequency) => void;
  onDelete: () => void;
};
export function ConfirmedAmountField(props: ConfirmedAmountFieldProps): JSX.Element;
```

- [ ] **Step 1: Create `src/components/ConfirmedAmountField.tsx`.** Move the current `FreqToggle`, `ConfirmedAmountFieldProps`, and `ConfirmedAmountField` from `OwnerOpWeeklyExpenses.tsx` (lines 42-156) verbatim, with exactly these changes:

1. `FreqToggle` becomes generic and prop-driven (replaces the hardcoded `['weekly','monthly']` array and W/M ternary):

```tsx
export function FreqToggle<F extends string>({
  value, onChange, options, labels,
}: {
  value: F; onChange: (v: F) => void; options: readonly F[]; labels: Record<F, string>;
}) {
  return (
    <View style={s.freqRow}>
      {options.map((f) => (
        <TouchableOpacity
          key={f}
          style={[s.freqBtn, value === f && s.freqBtnActive]}
          onPress={() => onChange(f)}
          activeOpacity={0.8}
        >
          <Text style={[s.freqText, value === f && s.freqTextActive]}>{labels[f]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

2. Inside `ConfirmedAmountField`, the toggle call site becomes:

```tsx
        {showFreq && (
          <FreqToggle
            value={draftFreq}
            onChange={setDraftFreq}
            options={['weekly', 'monthly'] as const}
            labels={{ weekly: 'W', monthly: 'M' }}
          />
        )}
```

3. Copy these style entries into the new file's own `StyleSheet.create` (names unchanged): `expenseBlock`, `fieldLabel`, `inputRow`, `prefix`, `inputFlex`, `lockedRow`, `lockedValue`, `lockedActions`, `iconBtn`, `confirmBtn`, `confirmBtnDisabled`, `cancelBtn`, `freqRow`, `freqBtn`, `freqBtnActive`, `freqText`, `freqTextActive`, `freqBadge`, `freqBadgeText`. Imports: React, useState, RN primitives, Ionicons, `C`, `fmt` from `../utils/format`, `Frequency` from `../types`. Both components exported.

- [ ] **Step 2: Update `OwnerOpWeeklyExpenses.tsx`:**

1. Delete the local `FreqToggle`, `ConfirmedAmountFieldProps`, `ConfirmedAmountField` definitions and the style entries that only they used (`expenseBlock`, `fieldLabel` stays — the screen uses it? No: `fieldLabel` is used only inside the moved component; delete it too, along with `lockedActions`... **CAREFUL:** the Other-entry locked rows in the screen still use `s.lockedRow`, `s.lockedValue`, `s.otherLabel`, `s.freqBadge`, `s.freqBadgeText`, `s.iconBtn`, `s.lockedActions`; the OtherExpenseEditor still uses `s.input`, `s.inputRow`, `s.prefix`, `s.inputFlex`, `s.cancelBtn`, `s.confirmBtn`, `s.confirmBtnDisabled`, `s.otherEditor`, `s.nameError`. Keep every style the remaining JSX references; delete only ones with zero remaining references (`expenseBlock`, `fieldLabel`, `freqRow`, `freqBtn`, `freqBtnActive`, `freqText`, `freqTextActive` — verify with a search before deleting each).
2. Import from the new module: `import { ConfirmedAmountField, FreqToggle } from '../../components/ConfirmedAmountField';` and add `OtherFrequency` to the types import.
3. `OtherExpenseEditor` changes: its `freq` state becomes `useState<OtherFrequency>(initial?.frequency ?? 'weekly')`, and its toggle call becomes:

```tsx
        <FreqToggle
          value={freq}
          onChange={setFreq}
          options={['daily', 'weekly', 'monthly'] as const}
          labels={{ daily: 'D', weekly: 'W', monthly: 'M' }}
        />
```

4. The locked Other-entry row badge (currently `o.frequency === 'monthly' ? 'M' : 'W'`) becomes:

```tsx
<Text style={s.freqBadgeText}>{o.frequency === 'monthly' ? 'M' : o.frequency === 'daily' ? 'D' : 'W'}</Text>
```

Everything else (persist/commit functions, keys, useFocusEffect) is untouched.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → no new errors
Run: `npm test` → only the 3 documented pre-existing failures.

- [ ] **Step 4: Commit**

```bash
git add src/components/ConfirmedAmountField.tsx src/screens/owner-op/OwnerOpWeeklyExpenses.tsx
git commit -m "refactor: extract ConfirmedAmountField; add daily option to other-expense editor"
```

---

### Task 4: Add Load earnings/TONU confirm fields

**Files:**
- Modify: `src/screens/owner-op/OwnerOpAddLoad.tsx`

`tsc` + full suite are the gates. This task also fixes the file's pre-existing `OwnerOpAddLoad.tsx:65` error (`driverType: string` not assignable to `DriverType`) since the edit region includes it.

**Interfaces:**
- Consumes: `ConfirmedAmountField` from `src/components/ConfirmedAmountField.tsx` (Task 3); `DriverType` from `src/types`.

- [ ] **Step 1: Implement in `src/screens/owner-op/OwnerOpAddLoad.tsx`:**

1. Add imports:

```tsx
import { ConfirmedAmountField } from '../../components/ConfirmedAmountField';
import type { LoadEntry, DriverType } from '../../types';
```

(replacing the existing `LoadEntry`-only type import).

2. Fix the pre-existing type error by typing the driverType const:

```tsx
const driverType = (route.params?.driverType ?? route.params?.load?.driverType ?? 'owner-op') as DriverType;
```

3. Convert earnings/tonu to numeric state:

```tsx
const [earnings, setEarnings] = useState(0);
const [tonu, setTonu] = useState(0);
```

In `useFocusEffect`: `setEarnings(editLoad.earnings ?? 0); setTonu(editLoad.tonu ?? 0);` for the edit branch and `setEarnings(0); setTonu(0);` for the reset branch.

4. Derived preview becomes:

```tsx
const commissionAmount = commissionRate != null && earnings > 0
  ? (earnings * commissionRate).toFixed(2)
  : null;
```

5. In `handleSave`: `const hasTonu = tonu > 0;`, the second validation becomes `if (!hasTonu && (earnings <= 0 || commissionRate === null))`, and the load object uses `earnings,` and `tonu,` directly (drop the `parseFloat(...) || 0` wrappers). Everything else in `handleSave` unchanged.

6. Replace the two plain input blocks (the `EARNINGS ($)` label + inputRow and the `TONU ($)` label + inputRow) with:

```tsx
<ConfirmedAmountField
  key={`earnings:${editLoad?.id ?? 'new'}:${weekKey}`}
  label="EARNINGS ($)"
  amount={earnings}
  onCommit={(v) => setEarnings(v)}
  onDelete={() => setEarnings(0)}
/>
<ConfirmedAmountField
  key={`tonu:${editLoad?.id ?? 'new'}:${weekKey}`}
  label="TONU ($)"
  amount={tonu}
  onCommit={(v) => setTonu(v)}
  onDelete={() => setTonu(0)}
/>
```

(No `frequency` prop → no toggle; `money` defaults true → `$` prefix + decimal pad. The keys remount fields per load and per week so drafts never leak.)

7. Remove now-unused styles if any (`inputRow`/`prefix`/`inputFlex` may become unreferenced — delete only if zero remaining references in this file; `input` is still used by the location fields).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → the `OwnerOpAddLoad.tsx:65` error is GONE and no new errors appear (remaining pre-existing errors only in the three test files).
Run: `npm test` → only the 3 documented pre-existing failures.

- [ ] **Step 3: Commit**

```bash
git add src/screens/owner-op/OwnerOpAddLoad.tsx
git commit -m "feat: confirm/lock earnings and TONU fields on add load"
```

---

### Task 5 (controller): End-to-end check with the user

- [ ] On the phone: Other editor shows D/W/M; add a $10 daily entry → Expenses insight shows "Parking · $70.00 · daily × 7"; locked row shows D badge. Add Load: type earnings → ✓ locks → pencil/trash work → Save Load persists; TONU-only save still works; editing an existing load shows locked prefilled fields.
