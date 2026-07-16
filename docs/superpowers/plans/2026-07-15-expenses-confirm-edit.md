# Expenses Confirm/Edit/Delete + Repeatable Other Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every amount field on the Owner-Op Expenses screen becomes confirm-to-save (✓) with locked display + inline edit/delete, saving instantly (no master Save button); "Other" becomes an unlimited list of named expenses synced as a JSONB column.

**Architecture:** New `OtherExpense` type + optional `otherExpenses` array on `WeeklyExpenses`. A single pure `normalizeExpenses()` in `calculations.ts` handles legacy `other` conversion; storage returns normalized objects. Screen rewritten around a module-scope `ConfirmedAmountField` with locked/editing states; every confirm calls `saveWeeklyExpenses` (which already enqueues the sync op). Supabase gets one new `other_expenses jsonb` column.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, Jest, Supabase.

**Spec:** `docs/superpowers/specs/2026-07-15-expenses-confirm-edit-design.md`

## Global Constraints

- No new npm dependencies. IDs via `import { v4 as uuidv4 } from 'uuid'` (pattern used by all AddLoad screens).
- Monthly→weekly conversion is `amount / 4.33`. Mileage deduction rate is `$0.14/mi`.
- `otherExpenses` is OPTIONAL on the type (`otherExpenses?: OtherExpense[]`) — normalization supplies `[]`; existing fixtures don't all need updating. (Deliberate deviation from the spec's "fixtures gain otherExpenses: []" — only fixtures that assert on it need it.)
- After normalization, consumers read ONLY `otherExpenses`; legacy `other` is zeroed by `normalizeExpenses` when converted. Never count both.
- Never define React components inside another component's function body.
- Screens never await the network; saves go through `saveWeeklyExpenses` (AsyncStorage + sync enqueue).
- Run tests with `npx jest <file>`; type-check with `npx tsc --noEmit` (pre-existing errors exist ONLY in `__tests__/calculations.test.ts`, `__tests__/storage.test.ts`, `__tests__/syncEngine.test.ts`, `src/screens/owner-op/OwnerOpAddLoad.tsx` — no new errors allowed).
- Full suite: only the 3 documented pre-existing `calculations.test.ts` failures may fail.

---

### Task 1: `OtherExpense` type, `normalizeExpenses`, calculations update

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/utils/calculations.ts`
- Test: `__tests__/expenses.test.ts` (new file — keeps new tests out of the pre-existing-failure file)

**Interfaces:**
- Produces:

```ts
// src/types/index.ts
export type OtherExpense = { id: string; label: string; amount: number; frequency: Frequency };
// WeeklyExpenses gains: otherExpenses?: OtherExpense[];

// src/utils/calculations.ts
export function normalizeExpenses(e: WeeklyExpenses): WeeklyExpenses;
// calcOwnerOpSummary now normalizes internally and sums otherExpenses instead of legacy `other`
```

- [ ] **Step 1: Write the failing tests** — create `__tests__/expenses.test.ts`:

```ts
import { normalizeExpenses, calcOwnerOpSummary } from '../src/utils/calculations';
import type { WeeklyExpenses } from '../src/types';

function makeExpenses(over: Partial<WeeklyExpenses> = {}): WeeklyExpenses {
  return {
    weekKey: '2026-07-13',
    truckPayment: 0, truckPaymentFrequency: 'weekly',
    truckInsurance: 0, truckInsuranceFrequency: 'weekly',
    trailerInsurance: 0, trailerInsuranceFrequency: 'weekly',
    trailerLease: 0, trailerLeaseFrequency: 'weekly',
    iftaCost: 0, iftaCostFrequency: 'weekly',
    adminFee: 0, adminFeeFrequency: 'weekly',
    other: 0, otherFrequency: 'weekly',
    startOdometer: 0, endOdometer: 0,
    ...over,
  };
}

describe('normalizeExpenses', () => {
  it('defaults missing otherExpenses to []', () => {
    expect(normalizeExpenses(makeExpenses()).otherExpenses).toEqual([]);
  });

  it('converts legacy other into one named entry and zeroes the legacy field', () => {
    const n = normalizeExpenses(makeExpenses({ other: 75, otherFrequency: 'monthly' }));
    expect(n.otherExpenses).toEqual([
      { id: 'legacy-other', label: 'Other', amount: 75, frequency: 'monthly' },
    ]);
    expect(n.other).toBe(0);
    expect(n.otherFrequency).toBe('weekly');
  });

  it('passes through already-migrated rows untouched (no legacy double-count)', () => {
    const entries = [{ id: 'a', label: 'Wash', amount: 50, frequency: 'weekly' as const }];
    const n = normalizeExpenses(makeExpenses({ other: 75, otherExpenses: entries }));
    expect(n.otherExpenses).toEqual(entries);
  });
});

describe('calcOwnerOpSummary with otherExpenses', () => {
  it('sums multiple entries with weekly/monthly conversion', () => {
    const e = makeExpenses({
      adminFee: 50,
      otherExpenses: [
        { id: 'a', label: 'Wash', amount: 50, frequency: 'weekly' },
        { id: 'b', label: 'Parts', amount: 433, frequency: 'monthly' }, // → 100/wk
      ],
    });
    expect(calcOwnerOpSummary([], e).totalExpenses).toBeCloseTo(200); // 50 + 50 + 100
  });

  it('counts legacy other exactly once via normalization', () => {
    const e = makeExpenses({ other: 60, otherFrequency: 'weekly' });
    expect(calcOwnerOpSummary([], e).totalExpenses).toBeCloseTo(60);
  });

  it('empty list adds nothing', () => {
    expect(calcOwnerOpSummary([], makeExpenses({ otherExpenses: [] })).totalExpenses).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/expenses.test.ts`
Expected: FAIL — `normalizeExpenses` is not exported.

- [ ] **Step 3: Implement.**

In `src/types/index.ts`, after the `Frequency` type:

```ts
export type OtherExpense = {
  id: string;
  label: string;
  amount: number;
  frequency: Frequency;
};
```

and inside `WeeklyExpenses`, after `otherFrequency: Frequency;`:

```ts
  otherExpenses?: OtherExpense[];
```

In `src/utils/calculations.ts`, add above `calcOwnerOpSummary` (and hoist the existing inner `toWeekly` to module scope so both functions share it):

```ts
const toWeekly = (amount: number, freq: 'weekly' | 'monthly' | undefined) =>
  freq === 'monthly' ? amount / 4.33 : amount;

export function normalizeExpenses(e: WeeklyExpenses): WeeklyExpenses {
  const otherExpenses = e.otherExpenses ?? [];
  if ((e.other ?? 0) > 0 && otherExpenses.length === 0) {
    return {
      ...e,
      other: 0,
      otherFrequency: 'weekly',
      otherExpenses: [
        { id: 'legacy-other', label: 'Other', amount: e.other ?? 0, frequency: e.otherFrequency ?? 'weekly' },
      ],
    };
  }
  return { ...e, otherExpenses };
}
```

In `calcOwnerOpSummary`: first line becomes `const expenses = normalizeExpenses(rawExpenses);` (rename the parameter to `rawExpenses`), delete the inner `toWeekly` const, and replace the `toWeekly(expenses.other ?? 0, expenses.otherFrequency)` term in `fixedExpenses` with:

```ts
    (expenses.otherExpenses ?? []).reduce((s, o) => s + toWeekly(o.amount, o.frequency), 0);
```

(keep every other term identical; `weekKey` still read from `expenses.weekKey`).

- [ ] **Step 4: Verify**

Run: `npx jest __tests__/expenses.test.ts __tests__/insights.test.ts` → all PASS (insights must not regress)
Run: `npx tsc --noEmit` → no new errors
Run: `npm test` → only the 3 documented pre-existing failures.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/utils/calculations.ts __tests__/expenses.test.ts
git commit -m "feat: OtherExpense type, normalizeExpenses, calc over other-expense list"
```

---

### Task 2: insights shows named Other entries

**Files:**
- Modify: `src/utils/insights.ts`
- Test: `__tests__/insights.test.ts` (append)

**Interfaces:**
- Consumes: `normalizeExpenses` from `src/utils/calculations.ts` (Task 1); `OtherExpense` type.
- Produces: unchanged `buildInsight` signature; Expenses breakdown rows now list each other-expense by name.

- [ ] **Step 1: Write the failing tests** — append to `__tests__/insights.test.ts` (reuses the file's existing `week`/`makeExpenses`/`makeLoad`/`makeFuel` helpers):

```ts
describe('expenses insight with named other expenses', () => {
  it('lists each entry by name with % sub', () => {
    const w = week({
      expenses: makeExpenses({
        otherExpenses: [
          { id: 'a', label: 'Truck wash', amount: 50, frequency: 'weekly' },
          { id: 'b', label: 'Parts', amount: 433, frequency: 'monthly' },
        ],
      }),
    });
    const i = buildInsight('expenses', w, null);
    const wash = i.rows.find((r) => r.label === 'Truck wash')!;
    const parts = i.rows.find((r) => r.label === 'Parts')!;
    expect(wash.value).toBe('$50.00');
    expect(parts.value).toBe('$100.00');
    expect(parts.sub).toContain('÷ 4.33');
    expect(i.headline).toBe('$150.00');
  });

  it('legacy other appears as a single "Other" row', () => {
    const w = week({ expenses: makeExpenses({ other: 60 }) });
    const i = buildInsight('expenses', w, null);
    expect(i.rows.find((r) => r.label === 'Other')!.value).toBe('$60.00');
    expect(i.headline).toBe('$60.00');
  });

  it('hasData counts other expenses for change comparison', () => {
    const prev = week({
      expenses: makeExpenses({ otherExpenses: [{ id: 'a', label: 'Wash', amount: 40, frequency: 'weekly' }] }),
    });
    const cur = week({
      expenses: makeExpenses({ otherExpenses: [{ id: 'b', label: 'Wash', amount: 60, frequency: 'weekly' }] }),
    });
    const c = buildInsight('expenses', cur, prev).change!;
    expect(c).not.toBeNull();
    expect(c.delta).toBeCloseTo(20);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/insights.test.ts`
Expected: the new describe FAILS (no 'Truck wash' row; change null); all previous tests PASS.

- [ ] **Step 3: Implement** — in `src/utils/insights.ts`:

Add `normalizeExpenses` to the calculations import (line 2):

```ts
import { calcOwnerOpSummary, normalizeExpenses } from './calculations';
```

In `expenseRows`, replace `const e = w.expenses;` with `const e = normalizeExpenses(w.expenses);` and replace the single line

```ts
    { label: 'Other', weekly: toWeekly(e.other ?? 0, e.otherFrequency), freq: e.otherFrequency },
```

with a spread of the entries (same position in the array, after Admin fee):

```ts
    ...(e.otherExpenses ?? []).map((o) => ({
      label: o.label, weekly: toWeekly(o.amount, o.frequency), freq: o.frequency,
    })),
```

In `hasData`, replace the body's first two statements with:

```ts
  const e = normalizeExpenses(w.expenses);
  const anyExpense =
    e.truckPayment + e.truckInsurance + e.trailerInsurance + e.trailerLease +
    e.iftaCost + e.adminFee +
    (e.otherExpenses ?? []).reduce((s, o) => s + o.amount, 0) > 0;
```

(the legacy `other` is covered because normalization converts it into an entry).

- [ ] **Step 4: Verify**

Run: `npx jest __tests__/insights.test.ts __tests__/expenses.test.ts` → PASS
Run: `npx tsc --noEmit` → no new errors

- [ ] **Step 5: Commit**

```bash
git add src/utils/insights.ts __tests__/insights.test.ts
git commit -m "feat: insights list named other expenses"
```

---

### Task 3: storage normalization + sync payload + schema file

**Files:**
- Modify: `src/storage/storage.ts:48-51` (getWeeklyExpenses), `src/storage/storage.ts:171-195` (pull mapping)
- Modify: `src/sync/syncEngine.ts:91-92` (upsert payload)
- Create: `src/supabase/schema-v3.sql`
- Test: `__tests__/expenses.test.ts` (append)

**Interfaces:**
- Consumes: `normalizeExpenses` from `src/utils/calculations.ts`.
- Produces: `getWeeklyExpenses` returns normalized objects; `upsertExpenses` sync op carries `other_expenses`; pull maps `row.other_expenses ?? []` into `otherExpenses`.

- [ ] **Step 1: Write the failing test** — append to `__tests__/expenses.test.ts` (this file must add the same AsyncStorage mock line used by `__tests__/storage.test.ts` at the top — copy it verbatim from that file, plus its supabase/sync mocks if getWeeklyExpenses's module imports require them; check how `storage.test.ts` mocks and mirror it):

```ts
// at top of file, mirroring __tests__/storage.test.ts's mock setup:
// jest.mock('@react-native-async-storage/async-storage', () =>
//   require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
// plus the same supabase + NetInfo mocks storage.test.ts uses.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWeeklyExpenses } from '../src/storage/storage';

describe('getWeeklyExpenses normalization', () => {
  it('returns legacy rows with other converted to an entry', async () => {
    await AsyncStorage.setItem(
      'expenses:owner-op:2026-07-13',
      JSON.stringify(makeExpenses({ other: 75, otherFrequency: 'monthly' }))
    );
    const e = (await getWeeklyExpenses('owner-op', '2026-07-13'))!;
    expect(e.otherExpenses).toEqual([
      { id: 'legacy-other', label: 'Other', amount: 75, frequency: 'monthly' },
    ]);
    expect(e.other).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest __tests__/expenses.test.ts`
Expected: new test FAILS (`otherExpenses` is `[]`... actually undefined pre-change; assertion fails either way).

- [ ] **Step 3: Implement.**

`src/storage/storage.ts`: add `import { normalizeExpenses } from '../utils/calculations';` and change `getWeeklyExpenses`:

```ts
export async function getWeeklyExpenses(driverType: string, weekKey: string): Promise<WeeklyExpenses | null> {
  const raw = await AsyncStorage.getItem(expensesKey(driverType, weekKey));
  return raw ? normalizeExpenses(JSON.parse(raw)) : null;
}
```

In `pullFromSupabase`'s expenses mapping, after the `otherFrequency` line add:

```ts
      otherExpenses: row.other_expenses ?? [],
```

`src/sync/syncEngine.ts`: in the `upsertExpenses` case, after `other_frequency: e.otherFrequency,` add:

```ts
        other_expenses: e.otherExpenses ?? [],
```

Create `src/supabase/schema-v3.sql`:

```sql
-- v3: repeatable named "other" expenses stored as JSONB on the weekly row
alter table weekly_expenses
  add column if not exists other_expenses jsonb not null default '[]'::jsonb;
```

- [ ] **Step 4: Verify**

Run: `npx jest __tests__/expenses.test.ts` → PASS
Run: `npm test` → only the 3 documented pre-existing failures
Run: `npx tsc --noEmit` → no new errors

- [ ] **Step 5: Commit**

```bash
git add src/storage/storage.ts src/sync/syncEngine.ts src/supabase/schema-v3.sql __tests__/expenses.test.ts
git commit -m "feat: persist and sync other_expenses; normalize on read"
```

---

### Task 4: Expenses screen rework

**Files:**
- Rewrite: `src/screens/owner-op/OwnerOpWeeklyExpenses.tsx`

No unit test (interactive screen; verified end-to-end after all tasks). `npx tsc --noEmit` is the gate.

**Interfaces:**
- Consumes: `saveWeeklyExpenses`/`getWeeklyExpenses` (storage), `normalizeExpenses` behavior (storage already returns normalized), `OtherExpense` type, `uuidv4`, `useWeek`/`formatWeekDisplay`, `ScreenHeader`, theme `C`, `fmt` from `src/utils/format.ts`.

- [ ] **Step 1: Replace the file's entire contents** with:

```tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { v4 as uuidv4 } from 'uuid';
import { ScreenHeader } from '../../components/ScreenHeader';
import { saveWeeklyExpenses, getWeeklyExpenses } from '../../storage/storage';
import { useWeek, formatWeekDisplay } from '../../context/WeekContext';
import { fmt } from '../../utils/format';
import { C } from '../../theme';
import type { WeeklyExpenses, Frequency, OtherExpense } from '../../types';

const EMPTY: WeeklyExpenses = {
  weekKey: '',
  truckPayment: 0, truckPaymentFrequency: 'weekly',
  truckInsurance: 0, truckInsuranceFrequency: 'weekly',
  trailerInsurance: 0, trailerInsuranceFrequency: 'weekly',
  trailerLease: 0, trailerLeaseFrequency: 'weekly',
  iftaCost: 0, iftaCostFrequency: 'weekly',
  adminFee: 0, adminFeeFrequency: 'weekly',
  other: 0, otherFrequency: 'weekly',
  otherExpenses: [],
  startOdometer: 0, endOdometer: 0,
};

type AmountKey = 'truckPayment' | 'truckInsurance' | 'trailerInsurance' | 'trailerLease' | 'iftaCost' | 'adminFee';
type FreqKey = `${AmountKey}Frequency`;

const FIXED_FIELDS: { key: AmountKey; freqKey: FreqKey; label: string }[] = [
  { key: 'truckPayment',     freqKey: 'truckPaymentFrequency',     label: 'TRUCK PAYMENT' },
  { key: 'truckInsurance',   freqKey: 'truckInsuranceFrequency',   label: 'TRUCK INSURANCE' },
  { key: 'trailerInsurance', freqKey: 'trailerInsuranceFrequency', label: 'TRAILER INSURANCE' },
  { key: 'trailerLease',     freqKey: 'trailerLeaseFrequency',     label: 'TRAILER LEASE' },
  { key: 'iftaCost',         freqKey: 'iftaCostFrequency',         label: 'IFTA STICKER COST' },
  { key: 'adminFee',         freqKey: 'adminFeeFrequency',         label: 'ADMIN FEE' },
];

function FreqToggle({ value, onChange }: { value: Frequency; onChange: (v: Frequency) => void }) {
  return (
    <View style={s.freqRow}>
      {(['weekly', 'monthly'] as const).map((f) => (
        <TouchableOpacity
          key={f}
          style={[s.freqBtn, value === f && s.freqBtnActive]}
          onPress={() => onChange(f)}
          activeOpacity={0.8}
        >
          <Text style={[s.freqText, value === f && s.freqTextActive]}>
            {f === 'weekly' ? 'W' : 'M'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

type ConfirmedAmountFieldProps = {
  label: string;
  amount: number;                 // saved value; 0 = empty
  frequency?: Frequency;          // omit for odometers
  money?: boolean;                // $ prefix + decimal pad (default true)
  placeholder?: string;
  onCommit: (amount: number, frequency: Frequency) => void;
  onDelete: () => void;
};

function ConfirmedAmountField({
  label, amount, frequency, money = true, placeholder = '0.00', onCommit, onDelete,
}: ConfirmedAmountFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [draftFreq, setDraftFreq] = useState<Frequency>(frequency ?? 'weekly');
  const showFreq = frequency !== undefined;
  const locked = amount > 0 && !editing;

  function startEdit() {
    setDraft(amount > 0 ? String(amount) : '');
    setDraftFreq(frequency ?? 'weekly');
    setEditing(true);
  }

  function confirm() {
    onCommit(parseFloat(draft) || 0, draftFreq);
    setEditing(false);
    setDraft('');
  }

  function confirmDelete() {
    Alert.alert(`Remove ${label.toLowerCase()}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onDelete },
    ]);
  }

  if (locked) {
    return (
      <View style={s.expenseBlock}>
        <Text style={s.fieldLabel}>{label}</Text>
        <View style={s.lockedRow}>
          <Ionicons name="checkmark-circle" size={18} color={C.success} />
          <Text style={s.lockedValue}>
            {money ? fmt(amount) : amount.toLocaleString()}
          </Text>
          {showFreq && (
            <View style={s.freqBadge}>
              <Text style={s.freqBadgeText}>{frequency === 'monthly' ? 'M' : 'W'}</Text>
            </View>
          )}
          <View style={s.lockedActions}>
            <TouchableOpacity style={s.iconBtn} onPress={startEdit}>
              <Ionicons name="pencil-outline" size={16} color={C.accent} />
            </TouchableOpacity>
            <TouchableOpacity style={s.iconBtn} onPress={confirmDelete}>
              <Ionicons name="trash-outline" size={16} color={C.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.expenseBlock}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.inputRow}>
        {money && <Text style={s.prefix}>$</Text>}
        <TextInput
          style={s.inputFlex}
          value={draft}
          onChangeText={setDraft}
          onFocus={() => { if (!editing) startEdit(); }}
          keyboardType={money ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={C.muted}
        />
        {showFreq && <FreqToggle value={draftFreq} onChange={setDraftFreq} />}
        {editing && amount > 0 && (
          <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditing(false); setDraft(''); }}>
            <Ionicons name="close" size={18} color={C.sub} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.confirmBtn, !draft && s.confirmBtnDisabled]}
          onPress={confirm}
          disabled={!draft}
        >
          <Ionicons name="checkmark" size={20} color={draft ? C.accentText : C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

type OtherEditorProps = {
  initial?: OtherExpense;
  onCommit: (entry: OtherExpense) => void;
  onCancel: () => void;
};

function OtherExpenseEditor({ initial, onCommit, onCancel }: OtherEditorProps) {
  const [name, setName] = useState(initial?.label ?? '');
  const [draft, setDraft] = useState(initial ? String(initial.amount) : '');
  const [freq, setFreq] = useState<Frequency>(initial?.frequency ?? 'weekly');
  const [nameError, setNameError] = useState(false);

  function confirm() {
    const label = name.trim();
    if (!label) { setNameError(true); return; }
    onCommit({
      id: initial?.id ?? uuidv4(),
      label,
      amount: parseFloat(draft) || 0,
      frequency: freq,
    });
  }

  return (
    <View style={s.otherEditor}>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={(t) => { setName(t); setNameError(false); }}
        placeholder="Expense name (e.g. Truck wash)"
        placeholderTextColor={C.muted}
      />
      {nameError && <Text style={s.nameError}>Name required</Text>}
      <View style={s.inputRow}>
        <Text style={s.prefix}>$</Text>
        <TextInput
          style={s.inputFlex}
          value={draft}
          onChangeText={setDraft}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={C.muted}
        />
        <FreqToggle value={freq} onChange={setFreq} />
        <TouchableOpacity style={s.cancelBtn} onPress={onCancel}>
          <Ionicons name="close" size={18} color={C.sub} />
        </TouchableOpacity>
        <TouchableOpacity style={s.confirmBtn} onPress={confirm}>
          <Ionicons name="checkmark" size={20} color={C.accentText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function OwnerOpWeeklyExpenses({ route }: { route: any }) {
  const driverType: string = route?.params?.driverType ?? 'owner-op';
  const { weekKey } = useWeek();
  const [exp, setExp] = useState<WeeklyExpenses>({ ...EMPTY, weekKey });
  const [addingOther, setAddingOther] = useState(false);
  const [editingOtherId, setEditingOtherId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getWeeklyExpenses(driverType, weekKey).then((saved) => {
        setExp(saved ?? { ...EMPTY, weekKey });
        setAddingOther(false);
        setEditingOtherId(null);
      });
    }, [weekKey])
  );

  function persist(updated: WeeklyExpenses) {
    setExp(updated);
    saveWeeklyExpenses(driverType, updated);
  }

  function commitField(key: AmountKey, freqKey: FreqKey, amount: number, freq: Frequency) {
    persist({ ...exp, [key]: amount, [freqKey]: freq });
  }

  function commitOdometer(key: 'startOdometer' | 'endOdometer', value: number) {
    persist({ ...exp, [key]: value });
  }

  function commitOther(entry: OtherExpense) {
    const list = exp.otherExpenses ?? [];
    const updated = list.some((o) => o.id === entry.id)
      ? list.map((o) => (o.id === entry.id ? entry : o))
      : [...list, entry];
    persist({ ...exp, otherExpenses: updated, other: 0, otherFrequency: 'weekly' });
    setAddingOther(false);
    setEditingOtherId(null);
  }

  function deleteOther(id: string) {
    persist({ ...exp, otherExpenses: (exp.otherExpenses ?? []).filter((o) => o.id !== id) });
  }

  const milesDriven = exp.endOdometer > exp.startOdometer ? exp.endOdometer - exp.startOdometer : 0;
  const mileageDeduction = milesDriven * 0.14;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ScreenHeader title="Expenses" subtitle={formatWeekDisplay(weekKey)} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={s.form}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <Text style={s.sectionTitle}>RECURRING EXPENSES</Text>
          {FIXED_FIELDS.map((f) => (
            <ConfirmedAmountField
              key={f.key}
              label={f.label}
              amount={exp[f.key]}
              frequency={exp[f.freqKey]}
              onCommit={(amount, freq) => commitField(f.key, f.freqKey, amount, freq)}
              onDelete={() => commitField(f.key, f.freqKey, 0, 'weekly')}
            />
          ))}

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>OTHER EXPENSES</Text>
          {(exp.otherExpenses ?? []).map((o) =>
            editingOtherId === o.id ? (
              <OtherExpenseEditor
                key={o.id}
                initial={o}
                onCommit={commitOther}
                onCancel={() => setEditingOtherId(null)}
              />
            ) : (
              <View key={o.id} style={s.lockedRow}>
                <Ionicons name="checkmark-circle" size={18} color={C.success} />
                <Text style={s.otherLabel} numberOfLines={1}>{o.label}</Text>
                <Text style={s.lockedValue}>{fmt(o.amount)}</Text>
                <View style={s.freqBadge}>
                  <Text style={s.freqBadgeText}>{o.frequency === 'monthly' ? 'M' : 'W'}</Text>
                </View>
                <View style={s.lockedActions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => { setEditingOtherId(o.id); setAddingOther(false); }}>
                    <Ionicons name="pencil-outline" size={16} color={C.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.iconBtn}
                    onPress={() =>
                      Alert.alert(`Remove ${o.label}?`, undefined, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Remove', style: 'destructive', onPress: () => deleteOther(o.id) },
                      ])
                    }
                  >
                    <Ionicons name="trash-outline" size={16} color={C.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            )
          )}
          {addingOther ? (
            <OtherExpenseEditor onCommit={commitOther} onCancel={() => setAddingOther(false)} />
          ) : (
            <TouchableOpacity
              style={s.addBtn}
              onPress={() => { setAddingOther(true); setEditingOtherId(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={18} color={C.accent} />
              <Text style={s.addBtnText}>Add Expense</Text>
            </TouchableOpacity>
          )}

          <Text style={[s.sectionTitle, { marginTop: 16 }]}>MILEAGE (ODOMETER)</Text>
          <ConfirmedAmountField
            label="STARTING ODOMETER"
            amount={exp.startOdometer}
            money={false}
            placeholder="e.g. 100000"
            onCommit={(v) => commitOdometer('startOdometer', v)}
            onDelete={() => commitOdometer('startOdometer', 0)}
          />
          <ConfirmedAmountField
            label="ENDING ODOMETER"
            amount={exp.endOdometer}
            money={false}
            placeholder="e.g. 103500"
            onCommit={(v) => commitOdometer('endOdometer', v)}
            onDelete={() => commitOdometer('endOdometer', 0)}
          />

          {milesDriven > 0 && (
            <View style={s.calcBox}>
              <Ionicons name="speedometer-outline" size={16} color={C.accent} />
              <View>
                <Text style={s.calcText}>Miles driven: {milesDriven.toLocaleString()} mi</Text>
                <Text style={s.calcText}>Mileage deduction: ${mileageDeduction.toFixed(2)}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  form: { padding: 20, paddingBottom: 140 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginBottom: 12, marginTop: 8 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1, marginBottom: 6, marginTop: 4 },
  expenseBlock: { marginBottom: 4 },
  input: {
    backgroundColor: C.card, borderRadius: 16,
    padding: 16, marginBottom: 8,
    fontSize: 16, color: C.text,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 16,
    paddingLeft: 16, paddingRight: 6, marginBottom: 12,
  },
  prefix: { fontSize: 16, color: C.sub },
  inputFlex: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
  lockedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.card, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  lockedValue: { fontSize: 16, fontWeight: '800', color: C.text },
  otherLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text },
  lockedActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  iconBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
  confirmBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
  },
  confirmBtnDisabled: { backgroundColor: C.cardElevated },
  cancelBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
  freqRow: {
    flexDirection: 'row', gap: 4,
    backgroundColor: C.bg, borderRadius: 999,
    padding: 3,
  },
  freqBtn: {
    width: 32, height: 28,
    borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  freqBtnActive: { backgroundColor: C.accent },
  freqText: { fontSize: 11, color: C.sub, fontWeight: '700' },
  freqTextActive: { color: C.accentText, fontWeight: '800' },
  freqBadge: {
    width: 24, height: 24, borderRadius: 999,
    backgroundColor: C.cardElevated, alignItems: 'center', justifyContent: 'center',
  },
  freqBadgeText: { fontSize: 10, color: C.sub, fontWeight: '800' },
  otherEditor: { marginBottom: 4 },
  nameError: { color: C.danger, fontSize: 12, marginBottom: 8, marginLeft: 4 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.card, borderRadius: 16, paddingVertical: 14, marginBottom: 12,
    borderWidth: 1, borderColor: C.cardElevated, borderStyle: 'dashed',
  },
  addBtnText: { color: C.accent, fontSize: 14, fontWeight: '700' },
  calcBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.card, borderRadius: 16, padding: 14, marginBottom: 20, marginTop: 8,
  },
  calcText: { color: C.accent, fontWeight: '600', fontSize: 14, lineHeight: 22 },
});
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → no new errors
Run: `npm test` → only the 3 documented pre-existing failures.

- [ ] **Step 3: Commit**

```bash
git add src/screens/owner-op/OwnerOpWeeklyExpenses.tsx
git commit -m "feat: confirm/edit/delete expense fields with instant save + repeatable other expenses"
```

---

### Task 5: Apply Supabase schema (controller-level, not a subagent task)

- [ ] Requires the Supabase project (ref `wuegzljzxnacssxzxfsh`) restored from pause and a `sbp_...` Management API token. Apply `src/supabase/schema-v3.sql` via `POST https://api.supabase.com/v1/projects/wuegzljzxnacssxzxfsh/database/query` with body `{"query": "<contents of schema-v3.sql>"}`. If no token is available, hand the SQL to the user to run in the dashboard SQL editor. Until applied, expense syncs will fail server-side and retry from the queue — local behavior is unaffected.

- [ ] **End-to-end check (with the user, on the phone):** confirm-lock cycle on a fixed field; edit and delete with the alert; add two named Other expenses (one monthly) and verify the Dashboard's Expenses insight lists them by name; odometer confirm + miles box; leave the tab and come back — values persist without any Save button.
