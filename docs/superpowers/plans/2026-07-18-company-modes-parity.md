# Company Modes Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring both company driver modes (per-mile, commission) to owner-op UX parity: city+state pickers in Add Load, ✓-confirm amount fields, and the driver/company name as the dashboard header title.

**Architecture:** Pure reuse — `StatePicker`, `splitCityState`/`joinCityState`, and `ConfirmedAmountField` already exist from the owner-op batch. Three screen files change per mode plus nothing else: no types, storage, sync, or schema changes. Loads keep persisting locations as `"City, ST"` strings.

**Tech Stack:** Expo SDK 54 / React Native, TypeScript, Jest (no new tests — no new pure logic).

## Global Constraints

- Persisted location format stays exactly `"City, ST"` (comma + space + 2-letter code) via `joinCityState`; on edit, `splitCityState` prefills city+state, unknown tails land wholly in city with state unselected.
- Validation alert copy for locations: `'Please enter city and select a state for both start and end.'` (title `'Missing fields'`).
- Confirmed-field keys follow the owner-op convention: `` `${field}:${editLoad?.id ?? 'new'}:${weekKey}` ``.
- Dashboard header: title = profile name when set, else mode title (`'Company Per Mile'` / `'Company Commission'`); subtitle = `'Driver dashboard'` when name set, else `'Tap to add name'`; tap runs the same `Alert.prompt` + `saveProfileName` flow as `OwnerOpDashboard.handleEditName`.
- Never define a React component inside another component's function body.
- After each task: `npx tsc --noEmit` clean and `npm test` green (94 tests, count unchanged).
- Work on branch `feat/company-modes-parity` off `master`.

---

### Task 1: CompanyMileAddLoad — city/state + confirmed mileage/rate

**Files:**
- Modify: `src/screens/company-mile/CompanyMileAddLoad.tsx`

**Interfaces:**
- Consumes: `StatePicker` from `src/components/StatePicker.tsx` (`{ label, value: string | null, onSelect(code) }`); `splitCityState(location)` → `{ city, state: string | null }` and `joinCityState(city, state)` from `src/utils/usStates.ts`; `ConfirmedAmountField` from `src/components/ConfirmedAmountField.tsx` (`{ label, amount: number, money?, placeholder?, onCommit(amount, freq), onDelete }`, locked when `amount > 0`).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Rework the screen**

Imports — add:

```tsx
import { StatePicker } from '../../components/StatePicker';
import { ConfirmedAmountField } from '../../components/ConfirmedAmountField';
import { splitCityState, joinCityState } from '../../utils/usStates';
```

Replace the four state hooks (lines 22-25):

```tsx
  const [startCity, setStartCity] = useState('');
  const [startState, setStartState] = useState<string | null>(null);
  const [endCity, setEndCity] = useState('');
  const [endState, setEndState] = useState<string | null>(null);
  const [paidMileage, setPaidMileage] = useState(0);
  const [centsPerMile, setCentsPerMile] = useState(0);
```

Replace the focus-effect body:

```tsx
      if (editLoad) {
        const start = splitCityState(editLoad.startLocation);
        const end = splitCityState(editLoad.endLocation);
        setStartCity(start.city);
        setStartState(start.state);
        setEndCity(end.city);
        setEndState(end.state);
        setPaidMileage(editLoad.paidMileage ?? 0);
        setCentsPerMile(editLoad.centsPerMile ?? 0);
      } else {
        setStartCity(''); setStartState(null);
        setEndCity(''); setEndState(null);
        setPaidMileage(0);
        setCentsPerMile(0);
      }
```

Replace the `loadEarnings` derivation:

```tsx
  const loadEarnings =
    paidMileage > 0 && centsPerMile > 0
      ? (paidMileage * centsPerMile).toFixed(2)
      : null;
```

Replace `handleSave`'s validation and load object:

```tsx
  async function handleSave() {
    if (!startCity.trim() || !startState || !endCity.trim() || !endState) {
      Alert.alert('Missing fields', 'Please enter city and select a state for both start and end.');
      return;
    }
    if (paidMileage <= 0 || centsPerMile <= 0) {
      Alert.alert('Missing fields', 'Enter and confirm the paid mileage and rate.');
      return;
    }
    const load: LoadEntry = {
      id: editLoad?.id ?? uuidv4(),
      weekKey: editLoad?.weekKey ?? weekKey,
      driverType: 'company-mile',
      startLocation: joinCityState(startCity, startState),
      endLocation: joinCityState(endCity, endState),
      createdAt: editLoad?.createdAt ?? new Date().toISOString(),
      paidMileage,
      centsPerMile,
    };
    await saveLoad(load);
    navigation.setParams({ load: undefined });
    navigation.navigate('Dashboard');
  }
```

Replace the form JSX between the ScrollView open tag and the calcBox:

```tsx
          <Text style={s.fieldLabel}>STARTING CITY</Text>
          <TextInput style={s.input} value={startCity} onChangeText={setStartCity} placeholder="e.g. Dallas" placeholderTextColor={C.muted} />
          <Text style={s.fieldLabel}>STARTING STATE</Text>
          <StatePicker label="Select state" value={startState} onSelect={setStartState} />

          <Text style={s.fieldLabel}>ENDING CITY</Text>
          <TextInput style={s.input} value={endCity} onChangeText={setEndCity} placeholder="e.g. Los Angeles" placeholderTextColor={C.muted} />
          <Text style={s.fieldLabel}>ENDING STATE</Text>
          <StatePicker label="Select state" value={endState} onSelect={setEndState} />

          <ConfirmedAmountField
            key={`paidMileage:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="PAID MILEAGE"
            amount={paidMileage}
            money={false}
            placeholder="e.g. 500"
            onCommit={(v) => setPaidMileage(v)}
            onDelete={() => setPaidMileage(0)}
          />
          <ConfirmedAmountField
            key={`centsPerMile:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="RATE ($ PER MILE)"
            amount={centsPerMile}
            placeholder="0.55"
            onCommit={(v) => setCentsPerMile(v)}
            onDelete={() => setCentsPerMile(0)}
          />
```

(The calcBox and Save button stay as they are. The old `inputRow`/`prefix`/`inputFlex` styles become unused — delete those three style entries.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npm test` → 8 suites / 94 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/screens/company-mile/CompanyMileAddLoad.tsx
git commit -m "feat: city/state pickers + confirmed mileage/rate in company-mile AddLoad"
```

---

### Task 2: CompanyCommissionAddLoad — city/state + confirmed earnings

**Files:**
- Modify: `src/screens/company-commission/CompanyCommissionAddLoad.tsx`

**Interfaces:**
- Consumes: same components/helpers as Task 1 (`StatePicker`, `ConfirmedAmountField`, `splitCityState`, `joinCityState`).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: Rework the screen**

Imports — add:

```tsx
import { StatePicker } from '../../components/StatePicker';
import { ConfirmedAmountField } from '../../components/ConfirmedAmountField';
import { splitCityState, joinCityState } from '../../utils/usStates';
```

Replace the state hooks (lines 23-26):

```tsx
  const [startCity, setStartCity] = useState('');
  const [startState, setStartState] = useState<string | null>(null);
  const [endCity, setEndCity] = useState('');
  const [endState, setEndState] = useState<string | null>(null);
  const [earnings, setEarnings] = useState(0);
  const [commissionRate, setCommissionRate] = useState<number | null>(null);
```

Replace the focus-effect body:

```tsx
      if (editLoad) {
        const start = splitCityState(editLoad.startLocation);
        const end = splitCityState(editLoad.endLocation);
        setStartCity(start.city);
        setStartState(start.state);
        setEndCity(end.city);
        setEndState(end.state);
        setEarnings(editLoad.earnings ?? 0);
        setCommissionRate(editLoad.commissionRate ?? null);
      } else {
        setStartCity(''); setStartState(null);
        setEndCity(''); setEndState(null);
        setEarnings(0);
        setCommissionRate(null);
      }
```

Replace the `driverCut` derivation:

```tsx
  const driverCut = commissionRate != null && earnings > 0
    ? (earnings * commissionRate).toFixed(2)
    : null;
```

Replace `handleSave`'s validation and load object:

```tsx
  async function handleSave() {
    if (!startCity.trim() || !startState || !endCity.trim() || !endState) {
      Alert.alert('Missing fields', 'Please enter city and select a state for both start and end.');
      return;
    }
    if (earnings <= 0 || commissionRate === null) {
      Alert.alert('Missing fields', 'Enter and confirm earnings and select a commission rate.');
      return;
    }
    const load: LoadEntry = {
      id: editLoad?.id ?? uuidv4(),
      weekKey: editLoad?.weekKey ?? weekKey,
      driverType: 'company-commission',
      startLocation: joinCityState(startCity, startState),
      endLocation: joinCityState(endCity, endState),
      createdAt: editLoad?.createdAt ?? new Date().toISOString(),
      earnings,
      commissionRate,
    };
    await saveLoad(load);
    navigation.setParams({ load: undefined });
    navigation.navigate('Dashboard');
  }
```

Replace the form JSX between the ScrollView open tag and the `CommissionSelector`:

```tsx
          <Text style={s.fieldLabel}>STARTING CITY</Text>
          <TextInput style={s.input} value={startCity} onChangeText={setStartCity} placeholder="e.g. Dallas" placeholderTextColor={C.muted} />
          <Text style={s.fieldLabel}>STARTING STATE</Text>
          <StatePicker label="Select state" value={startState} onSelect={setStartState} />

          <Text style={s.fieldLabel}>ENDING CITY</Text>
          <TextInput style={s.input} value={endCity} onChangeText={setEndCity} placeholder="e.g. Miami" placeholderTextColor={C.muted} />
          <Text style={s.fieldLabel}>ENDING STATE</Text>
          <StatePicker label="Select state" value={endState} onSelect={setEndState} />

          <ConfirmedAmountField
            key={`earnings:${editLoad?.id ?? 'new'}:${weekKey}`}
            label="EARNINGS ($)"
            amount={earnings}
            onCommit={(v) => setEarnings(v)}
            onDelete={() => setEarnings(0)}
          />
```

(`CommissionSelector`, the "Your Cut" calcBox, and the Save button stay as they are. The old `inputRow`/`prefix`/`inputFlex` styles become unused — delete those three style entries.)

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npm test` → 8 suites / 94 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/screens/company-commission/CompanyCommissionAddLoad.tsx
git commit -m "feat: city/state pickers + confirmed earnings in company-commission AddLoad"
```

---

### Task 3: Company dashboards — name as header title

**Files:**
- Modify: `src/screens/company-mile/CompanyMileDashboard.tsx`
- Modify: `src/screens/company-commission/CompanyCommissionDashboard.tsx`

**Interfaces:**
- Consumes: `getProfileName(): Promise<string>` and `saveProfileName(name: string): Promise<void>` from `src/storage/storage.ts` (same functions `OwnerOpDashboard` uses).
- Produces: nothing consumed by other tasks.

- [ ] **Step 1: CompanyMileDashboard**

Change the storage import (line 9):

```tsx
import { getLoadsForWeek, deleteLoad, getProfileName, saveProfileName } from '../../storage/storage';
```

Add state under `loads`:

```tsx
  const [driverName, setDriverName] = useState('');
```

Replace the focus-effect body:

```tsx
      getLoadsForWeek('company-mile', weekKey).then(setLoads);
      getProfileName().then(setDriverName);
```

Add the edit handler above `handleEdit` (identical to `OwnerOpDashboard.handleEditName`):

```tsx
  function handleEditName() {
    Alert.prompt('Driver / Company Name', '', async (text) => {
      if (text !== null && text !== undefined) {
        await saveProfileName(text.trim());
        setDriverName(text.trim());
      }
    }, 'plain-text', driverName);
  }
```

Replace the ScreenHeader:

```tsx
      <ScreenHeader
        title={driverName || 'Company Per Mile'}
        subtitle={driverName ? 'Driver dashboard' : 'Tap to add name'}
        onPress={handleEditName}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SyncStatusBadge />
            <SignOutButton />
          </View>
        }
      />
```

- [ ] **Step 2: CompanyCommissionDashboard**

Apply the identical changes to `src/screens/company-commission/CompanyCommissionDashboard.tsx`, with these three differences: the storage call is `getLoadsForWeek('company-commission', weekKey)` (already there — only append the `getProfileName().then(setDriverName);` line), and the ScreenHeader fallback title is `'Company Commission'`:

```tsx
      <ScreenHeader
        title={driverName || 'Company Commission'}
        subtitle={driverName ? 'Driver dashboard' : 'Tap to add name'}
        onPress={handleEditName}
        right={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <SyncStatusBadge />
            <SignOutButton />
          </View>
        }
      />
```

(All other pieces — the import addition, `driverName` state, `handleEditName` — are byte-identical to Step 1's code.)

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npm test` → 8 suites / 94 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/company-mile/CompanyMileDashboard.tsx src/screens/company-commission/CompanyCommissionDashboard.tsx
git commit -m "feat: show driver/company name as company dashboard header title"
```

---

## Task ordering / parallel lanes

All three tasks touch disjoint files and share no produced interfaces — they can run fully in parallel.

## Manual test checklist (preview APK, after merge)

- Per-mile Add Load: city + state pickers both ends; mileage and rate lock with ✓; earnings preview appears after both confirmed; editing an old `"City, ST"` load prefills; free-text legacy load lands in city.
- Commission Add Load: same locations; earnings ✓-confirms; commission selector + "Your Cut" unchanged.
- Both dashboards: signup name shows as the big title above "Driver dashboard"; tap title to edit; empty name falls back to mode title + "Tap to add name".
