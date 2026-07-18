# Name Edit Modal + Extra Mileage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working tap-to-edit name on all four dashboards (cross-platform modal replacing iOS-only Alert.prompt) and an optional EXTRA MILEAGE field on company per-mile loads paid at the same rate.

**Architecture:** One new module-scope modal component consumed by three dashboard files; `extraMileage?: number` threads additively through types → calc → AddLoad → display rows → sync/pull, with a nullable `extra_mileage` column (schema-v5, applied to the live DB by the controller before merge).

**Tech Stack:** Expo SDK 54 / React Native, TypeScript, Jest.

## Global Constraints

- Per-mile earnings math everywhere: `(paidMileage + (extraMileage ?? 0)) × centsPerMile`.
- EXTRA MILEAGE is optional: 0/empty valid; save validation still requires only `paidMileage > 0 && centsPerMile > 0`.
- Load rows show `+ {extra} extra` only when extra > 0.
- Name modal: empty save allowed (clears name; headers fall back). Never define a React component inside another component's body.
- After each task: `npx tsc --noEmit` clean, `npm test` green.
- Branch `feat/name-edit-extra-mileage` off `master`. Tasks run SEQUENTIALLY (Task 2 touches CompanyMileDashboard too).

---

### Task 1: NameEditModal + wire into all dashboards

**Files:**
- Create: `src/components/NameEditModal.tsx`
- Modify: `src/screens/owner-op/OwnerOpDashboard.tsx` (handleEditName + render)
- Modify: `src/screens/company-mile/CompanyMileDashboard.tsx` (same)
- Modify: `src/screens/company-commission/CompanyCommissionDashboard.tsx` (same)

**Interfaces:**
- Produces: `NameEditModal({ visible, initialName, onSave, onClose }: { visible: boolean; initialName: string; onSave: (name: string) => void; onClose: () => void })`.
- Consumes: `saveProfileName` (already imported in all three dashboards).

- [ ] **Step 1: Create `src/components/NameEditModal.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { C } from '../theme';

type Props = {
  visible: boolean;
  initialName: string;
  onSave: (name: string) => void;
  onClose: () => void;
};

export function NameEditModal({ visible, initialName, onSave, onClose }: Props) {
  const [draft, setDraft] = useState(initialName);

  useEffect(() => {
    if (visible) setDraft(initialName);
  }, [visible, initialName]);

  function handleSave() {
    onSave(draft.trim());
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.backdrop}
      >
        <View style={s.card}>
          <Text style={s.title}>Driver / Company Name</Text>
          <TextInput
            style={s.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. Fatih Atak"
            placeholderTextColor={C.muted}
            autoFocus
            autoCapitalize="words"
          />
          <View style={s.row}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={s.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    alignSelf: 'stretch', backgroundColor: C.card, borderRadius: 20, padding: 20,
  },
  title: { fontSize: 12, fontWeight: '700', color: C.sub, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 12 },
  input: {
    backgroundColor: C.cardElevated, borderRadius: 14,
    padding: 14, fontSize: 16, color: C.text, marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    backgroundColor: C.cardElevated, alignItems: 'center',
  },
  cancelText: { color: C.sub, fontSize: 15, fontWeight: '700' },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 999,
    backgroundColor: C.accent, alignItems: 'center',
  },
  saveText: { color: C.accentText, fontSize: 15, fontWeight: '800' },
});
```

- [ ] **Step 2: Wire into each dashboard (identical pattern ×3)**

In `OwnerOpDashboard.tsx`, `CompanyMileDashboard.tsx`, `CompanyCommissionDashboard.tsx`:

1. Add import: `import { NameEditModal } from '../../components/NameEditModal';`
2. Add state: `const [nameModalOpen, setNameModalOpen] = useState(false);`
3. Replace the whole `handleEditName` body (delete the `Alert.prompt` version):

```tsx
  function handleEditName() {
    setNameModalOpen(true);
  }
```

4. Render the modal as the LAST child inside the root `<View style={s.root}>` (after the ScrollView, and in OwnerOpDashboard after `<InsightsSheet …/>`):

```tsx
      <NameEditModal
        visible={nameModalOpen}
        initialName={driverName}
        onSave={async (name) => {
          await saveProfileName(name);
          setDriverName(name);
        }}
        onClose={() => setNameModalOpen(false)}
      />
```

5. In `OwnerOpDashboard.tsx` only, `Alert` remains used by `handleDelete` — keep the import. In the two company dashboards, `Alert` is still used by `handleDelete` too — keep imports everywhere.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit` → clean. Run: `npm test` → 8 suites / 94 tests pass (Task 1 adds no tests).

```bash
git add src/components/NameEditModal.tsx src/screens/owner-op/OwnerOpDashboard.tsx src/screens/company-mile/CompanyMileDashboard.tsx src/screens/company-commission/CompanyCommissionDashboard.tsx
git commit -m "feat: cross-platform name edit modal on all dashboards"
```

---

### Task 2: Extra mileage end-to-end (company per-mile)

**Files:**
- Modify: `src/types/index.ts` (LoadEntry)
- Modify: `src/utils/calculations.ts` (calcCompanyMileSummary)
- Modify: `src/screens/company-mile/CompanyMileAddLoad.tsx`
- Modify: `src/screens/company-mile/CompanyMileDashboard.tsx` (load row text)
- Modify: `src/screens/company-mile/CompanyMileHistory.tsx` (load row text, line ~151)
- Modify: `src/sync/syncEngine.ts` (upsertLoad payload)
- Modify: `src/storage/storage.ts` (pullFromSupabase load mapping)
- Create: `src/supabase/schema-v5.sql`
- Test: `__tests__/calculations.test.ts`, `__tests__/syncEngine.test.ts` (append)

**Interfaces:**
- Consumes: Task 1 already merged into the same branch (CompanyMileDashboard has the name modal — do not disturb it).
- Produces: `LoadEntry.extraMileage?: number`; DB column `loads.extra_mileage numeric` (nullable).

- [ ] **Step 1: Write failing tests**

Append to `__tests__/calculations.test.ts`:

```ts
describe('company-mile extra mileage', () => {
  test('extra mileage paid at the same rate', () => {
    const s = calcCompanyMileSummary([
      { id: '1', weekKey: '2026-07-13', driverType: 'company-mile', startLocation: 'A, TX', endLocation: 'B, TX', createdAt: '', paidMileage: 500, centsPerMile: 0.55, extraMileage: 50 },
    ] as any);
    expect(s.totalEarnings).toBeCloseTo(302.5);
  });
  test('absent extra mileage unchanged', () => {
    const s = calcCompanyMileSummary([
      { id: '1', weekKey: '2026-07-13', driverType: 'company-mile', startLocation: 'A, TX', endLocation: 'B, TX', createdAt: '', paidMileage: 500, centsPerMile: 0.55 },
    ] as any);
    expect(s.totalEarnings).toBeCloseTo(275);
  });
});
```

(If `calcCompanyMileSummary` isn't imported in the file yet, add it to the import.)

Append to `__tests__/syncEngine.test.ts`, mirroring the existing upsertLoad capture tests:

```ts
test('upsertLoad payload includes extra_mileage (null when absent)', async () => {
  // enqueue upsertLoad with no extraMileage; flush; assert capturedUpsert.extra_mileage === null
});
test('upsertLoad payload carries extraMileage value', async () => {
  // enqueue with extraMileage: 50; flush; assert capturedUpsert.extra_mileage === 50
});
```

Run both files → FAIL (property unknown / undefined).

- [ ] **Step 2: Types + calc + sync + pull + schema**

`src/types/index.ts` — in `LoadEntry`, after `centsPerMile?: number;`:

```ts
  extraMileage?: number;
```

`src/utils/calculations.ts` — `calcCompanyMileSummary` reduce becomes:

```ts
  const totalEarnings = loads.reduce(
    (sum, l) => sum + ((l.paidMileage ?? 0) + (l.extraMileage ?? 0)) * (l.centsPerMile ?? 0),
    0
  );
```

`src/sync/syncEngine.ts` — upsertLoad payload, after `cents_per_mile: l.centsPerMile ?? null,`:

```ts
        extra_mileage: l.extraMileage ?? null,
```

`src/storage/storage.ts` — pullFromSupabase load mapping, after `centsPerMile: row.cents_per_mile ?? undefined,`:

```ts
      extraMileage: row.extra_mileage != null ? Number(row.extra_mileage) : undefined,
```

Create `src/supabase/schema-v5.sql`:

```sql
-- schema-v5: optional extra paid mileage on loads (company per-mile).
-- Additive and idempotent — safe to run on a live database.
alter table loads add column if not exists extra_mileage numeric;
```

Run the two test files → PASS.

- [ ] **Step 3: AddLoad field + preview**

`src/screens/company-mile/CompanyMileAddLoad.tsx`:

1. State, after `paidMileage`: `const [extraMileage, setExtraMileage] = useState(0);`
2. Focus effect: `setExtraMileage(editLoad.extraMileage ?? 0);` in the edit branch, `setExtraMileage(0);` in the reset branch.
3. Preview:

```tsx
  const loadEarnings =
    paidMileage > 0 && centsPerMile > 0
      ? ((paidMileage + extraMileage) * centsPerMile).toFixed(2)
      : null;
```

4. Load object: `extraMileage,` after `centsPerMile,`. (Validation unchanged.)
5. JSX — directly under the PAID MILEAGE ConfirmedAmountField:

```tsx
          <ConfirmedAmountField
            key={`extraMileage:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="EXTRA MILEAGE"
            amount={extraMileage}
            money={false}
            placeholder="e.g. 50"
            onCommit={(v) => setExtraMileage(v)}
            onDelete={() => setExtraMileage(0)}
          />
```

- [ ] **Step 4: Display rows**

`CompanyMileDashboard.tsx` load row (currently `` {load.paidMileage} mi × ${load.centsPerMile?.toFixed(2)}/mi = … ``) becomes:

```tsx
                <Text style={s.loadDetail}>
                  {load.paidMileage} mi{(load.extraMileage ?? 0) > 0 ? ` + ${load.extraMileage} extra` : ''} × ${load.centsPerMile?.toFixed(2)}/mi = <Text style={s.loadDetailBold}>{fmt(((load.paidMileage ?? 0) + (load.extraMileage ?? 0)) * (load.centsPerMile ?? 0))}</Text>
                </Text>
```

`CompanyMileHistory.tsx` line ~151 gets the identical treatment (keep its `s.bold` style name):

```tsx
                          {load.paidMileage} mi{(load.extraMileage ?? 0) > 0 ? ` + ${load.extraMileage} extra` : ''} × ${load.centsPerMile?.toFixed(2)}/mi = <Text style={s.bold}>{fmt(((load.paidMileage ?? 0) + (load.extraMileage ?? 0)) * (load.centsPerMile ?? 0))}</Text>
```

- [ ] **Step 5: Verify + commit**

`npx tsc --noEmit` clean; `npm test` → 8 suites, 98 tests pass (4 new).

```bash
git add src/types/index.ts src/utils/calculations.ts src/screens/company-mile/CompanyMileAddLoad.tsx src/screens/company-mile/CompanyMileDashboard.tsx src/screens/company-mile/CompanyMileHistory.tsx src/sync/syncEngine.ts src/storage/storage.ts src/supabase/schema-v5.sql __tests__/calculations.test.ts __tests__/syncEngine.test.ts
git commit -m "feat: extra paid mileage on company-mile loads (schema-v5)"
```

---

## Controller-only follow-up

Apply `src/supabase/schema-v5.sql` to the live DB via the Management API and verify by read-back BEFORE merging to master (upsertLoad sends `extra_mileage` on every load save for all driver types).

## Task ordering

Sequential: Task 1 → Task 2 (both touch `CompanyMileDashboard.tsx`).

## Manual test checklist

- Any dashboard: tap header name/title → dialog opens on Android; type, Save → header updates; Cancel leaves it; empty Save clears to fallback.
- Per-mile Add Load: EXTRA MILEAGE under PAID MILEAGE; optional; preview = (paid+extra)×rate; edit round-trips; dashboard/history rows show "+ N extra" only when set.
