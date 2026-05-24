# TruckersPro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first iOS expense tracker for truckers with three driver modes (Owner Operator, Company/Mile, Company/Commission), load-by-load entry, and auto-calculated weekly summaries.

**Architecture:** Expo + React Native app scaffolded with `create-expo-app`. Navigation uses React Navigation (stack + tabs). All data persists to AsyncStorage keyed by driver type + Monday week date. Calculation logic lives in pure utility functions tested with Jest.

**Tech Stack:** Expo SDK 51+, React Native, TypeScript, React Navigation v6, @react-native-async-storage/async-storage, Jest + @testing-library/react-native

---

## File Map

```
TruckersPro/
├── App.tsx                                     # Root navigator entry point
├── src/
│   ├── types/index.ts                          # All shared TypeScript types
│   ├── utils/
│   │   ├── weekKey.ts                          # getWeekKey(), getCurrentWeekKey()
│   │   └── calculations.ts                     # All earnings/expense/profit formulas
│   ├── storage/
│   │   └── storage.ts                          # AsyncStorage typed CRUD helpers
│   ├── navigation/
│   │   └── index.tsx                           # All navigators defined here
│   ├── screens/
│   │   ├── HomeScreen.tsx                      # Driver type selection
│   │   ├── owner-op/
│   │   │   ├── OwnerOpDashboard.tsx
│   │   │   ├── OwnerOpAddLoad.tsx
│   │   │   ├── OwnerOpWeeklyExpenses.tsx
│   │   │   └── OwnerOpHistory.tsx
│   │   ├── company-mile/
│   │   │   ├── CompanyMileDashboard.tsx
│   │   │   ├── CompanyMileAddLoad.tsx
│   │   │   └── CompanyMileHistory.tsx
│   │   └── company-commission/
│   │       ├── CompanyCommissionDashboard.tsx
│   │       ├── CompanyCommissionAddLoad.tsx
│   │       └── CompanyCommissionHistory.tsx
│   └── components/
│       ├── CurrencyInput.tsx                   # Number input with $ prefix
│       ├── CommissionSelector.tsx              # Pill-style % selector
│       └── SummaryCard.tsx                     # Label + value display card
├── __tests__/
│   ├── weekKey.test.ts
│   ├── calculations.test.ts
│   └── storage.test.ts
```

---

## Task 1: Scaffold Expo Project

**Files:**
- Create: `TruckersPro/` (entire project)

- [ ] **Step 1: Scaffold the project**

Run in `c:/Claude/` (the parent directory):
```bash
cd c:/Claude
npx create-expo-app@latest Truckerspro --template blank-typescript
```
Expected: Project created with `App.tsx`, `package.json`, `tsconfig.json`.

- [ ] **Step 2: Install dependencies**

```bash
cd c:/Claude/Truckerspro
npx expo install @react-native-async-storage/async-storage
npx expo install react-native-screens react-native-safe-area-context
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install --save-dev @testing-library/react-native @testing-library/jest-native
```

- [ ] **Step 3: Create src directory structure**

```bash
mkdir -p src/types src/utils src/storage src/navigation src/screens/owner-op src/screens/company-mile src/screens/company-commission src/components __tests__
```

- [ ] **Step 4: Verify app launches**

```bash
npx expo start
```
Scan the QR code with Expo Go on your iPhone. Expected: blank white screen with "Open up App.tsx to start working on your app!".

- [ ] **Step 5: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Expo TypeScript project with dependencies"
```

---

## Task 2: Define Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/types/index.ts

export type DriverType = 'owner-op' | 'company-mile' | 'company-commission';

export type LoadEntry = {
  id: string;
  weekKey: string;
  driverType: DriverType;
  startLocation: string;
  endLocation: string;
  createdAt: string;

  // owner-op + company-commission
  earnings?: number;
  commissionRate?: number; // e.g. 0.10, 0.12, 0.15, 0.20, 0.25, 0.30, 0.35

  // owner-op only
  diesel?: number;
  def?: number;

  // company-mile only
  paidMileage?: number;
  centsPerMile?: number;
};

export type WeeklyExpenses = {
  weekKey: string;
  truckPayment: number;
  truckPaymentFrequency: 'weekly' | 'monthly';
  truckInsurance: number;
  trailerInsurance: number;
  trailerLease: number;
  iftaCost: number;
  adminFee: number;
  startOdometer: number;
  endOdometer: number;
};

export type OwnerOpWeeklySummary = {
  weekKey: string;
  totalEarnings: number;
  totalExpenses: number;
  milesDriven: number;
  mileageDeduction: number;
  netProfit: number;
};

export type CompanyMileWeeklySummary = {
  weekKey: string;
  totalEarnings: number;
  netProfit: number;
};

export type CompanyCommissionWeeklySummary = {
  weekKey: string;
  totalEarnings: number;
  netProfit: number;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: define LoadEntry, WeeklyExpenses and summary types"
```

---

## Task 3: Week Key Utility

**Files:**
- Create: `src/utils/weekKey.ts`
- Create: `__tests__/weekKey.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/weekKey.test.ts
import { getWeekKey, getCurrentWeekKey } from '../src/utils/weekKey';

describe('getWeekKey', () => {
  it('returns Monday ISO date for a Monday', () => {
    // 2026-05-25 is a Monday
    expect(getWeekKey(new Date('2026-05-25'))).toBe('2026-05-25');
  });

  it('returns the previous Monday for a Wednesday', () => {
    // 2026-05-27 is a Wednesday → Monday is 2026-05-25
    expect(getWeekKey(new Date('2026-05-27'))).toBe('2026-05-25');
  });

  it('returns the previous Monday for a Sunday', () => {
    // 2026-05-31 is a Sunday → Monday is 2026-05-25
    expect(getWeekKey(new Date('2026-05-31'))).toBe('2026-05-25');
  });
});

describe('getCurrentWeekKey', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    expect(getCurrentWeekKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/weekKey.test.ts
```
Expected: FAIL — "Cannot find module '../src/utils/weekKey'"

- [ ] **Step 3: Implement weekKey utility**

```typescript
// src/utils/weekKey.ts
export function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function getCurrentWeekKey(): string {
  return getWeekKey(new Date());
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/weekKey.test.ts
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/weekKey.ts __tests__/weekKey.test.ts
git commit -m "feat: add getWeekKey utility with tests"
```

---

## Task 4: Calculation Logic

**Files:**
- Create: `src/utils/calculations.ts`
- Create: `__tests__/calculations.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/calculations.test.ts
import {
  calcOwnerOpSummary,
  calcCompanyMileSummary,
  calcCompanyCommissionSummary,
} from '../src/utils/calculations';
import type { LoadEntry, WeeklyExpenses } from '../src/types';

const weekKey = '2026-05-25';

describe('calcOwnerOpSummary', () => {
  const loads: LoadEntry[] = [
    {
      id: '1', weekKey, driverType: 'owner-op',
      startLocation: 'TX', endLocation: 'CA',
      createdAt: '2026-05-25',
      earnings: 3000, commissionRate: 0.10, diesel: 400, def: 30,
    },
    {
      id: '2', weekKey, driverType: 'owner-op',
      startLocation: 'CA', endLocation: 'AZ',
      createdAt: '2026-05-26',
      earnings: 1500, commissionRate: 0.12, diesel: 200, def: 15,
    },
  ];
  const expenses: WeeklyExpenses = {
    weekKey,
    truckPayment: 600, truckPaymentFrequency: 'weekly',
    truckInsurance: 250, trailerInsurance: 80,
    trailerLease: 200, iftaCost: 50, adminFee: 40,
    startOdometer: 100000, endOdometer: 103500,
  };

  it('calculates totalEarnings', () => {
    const result = calcOwnerOpSummary(loads, expenses);
    expect(result.totalEarnings).toBe(4500); // 3000 + 1500
  });

  it('calculates commissions per load', () => {
    // Load 1: 3000 * 0.10 = 300, Load 2: 1500 * 0.12 = 180
    const result = calcOwnerOpSummary(loads, expenses);
    // totalExpenses = fixed(600+250+80+200+50+40) + perLoad(400+30+300 + 200+15+180)
    // fixed = 1220, perLoad = 1125, total = 2345
    expect(result.totalExpenses).toBe(2345);
  });

  it('calculates mileage deduction', () => {
    const result = calcOwnerOpSummary(loads, expenses);
    expect(result.milesDriven).toBe(3500);
    expect(result.mileageDeduction).toBeCloseTo(490, 1); // 3500 * 0.14
  });

  it('calculates net profit', () => {
    const result = calcOwnerOpSummary(loads, expenses);
    // 4500 - 2345 - 490 = 1665
    expect(result.netProfit).toBeCloseTo(1665, 0);
  });

  it('handles monthly truck payment by dividing by 4.33', () => {
    const monthlyExpenses = { ...expenses, truckPaymentFrequency: 'monthly' as const };
    const result = calcOwnerOpSummary(loads, monthlyExpenses);
    const weeklyTruckPayment = 600 / 4.33;
    const fixedExpenses = weeklyTruckPayment + 250 + 80 + 200 + 50 + 40;
    const perLoadExpenses = 400 + 30 + 300 + 200 + 15 + 180;
    expect(result.totalExpenses).toBeCloseTo(fixedExpenses + perLoadExpenses, 1);
  });
});

describe('calcCompanyMileSummary', () => {
  const loads: LoadEntry[] = [
    {
      id: '1', weekKey, driverType: 'company-mile',
      startLocation: 'TX', endLocation: 'OK', createdAt: '2026-05-25',
      paidMileage: 500, centsPerMile: 0.55,
    },
    {
      id: '2', weekKey, driverType: 'company-mile',
      startLocation: 'OK', endLocation: 'MO', createdAt: '2026-05-26',
      paidMileage: 300, centsPerMile: 0.55,
    },
  ];

  it('calculates totalEarnings', () => {
    const result = calcCompanyMileSummary(loads);
    expect(result.totalEarnings).toBeCloseTo(440, 2); // (500+300)*0.55
  });

  it('sets netProfit equal to totalEarnings', () => {
    const result = calcCompanyMileSummary(loads);
    expect(result.netProfit).toBe(result.totalEarnings);
  });
});

describe('calcCompanyCommissionSummary', () => {
  const loads: LoadEntry[] = [
    {
      id: '1', weekKey, driverType: 'company-commission',
      startLocation: 'TX', endLocation: 'FL', createdAt: '2026-05-25',
      earnings: 2000, commissionRate: 0.25,
    },
    {
      id: '2', weekKey, driverType: 'company-commission',
      startLocation: 'FL', endLocation: 'GA', createdAt: '2026-05-26',
      earnings: 1000, commissionRate: 0.30,
    },
  ];

  it('calculates totalEarnings as sum of driver cuts', () => {
    const result = calcCompanyCommissionSummary(loads);
    expect(result.totalEarnings).toBeCloseTo(800, 2); // 2000*0.25 + 1000*0.30
  });

  it('sets netProfit equal to totalEarnings', () => {
    const result = calcCompanyCommissionSummary(loads);
    expect(result.netProfit).toBe(result.totalEarnings);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/calculations.test.ts
```
Expected: FAIL — "Cannot find module '../src/utils/calculations'"

- [ ] **Step 3: Implement calculations**

```typescript
// src/utils/calculations.ts
import type { LoadEntry, WeeklyExpenses, OwnerOpWeeklySummary, CompanyMileWeeklySummary, CompanyCommissionWeeklySummary } from '../types';

export function calcOwnerOpSummary(
  loads: LoadEntry[],
  expenses: WeeklyExpenses
): OwnerOpWeeklySummary {
  const weekKey = expenses.weekKey;

  const totalEarnings = loads.reduce((sum, l) => sum + (l.earnings ?? 0), 0);

  const truckPaymentWeekly =
    expenses.truckPaymentFrequency === 'monthly'
      ? expenses.truckPayment / 4.33
      : expenses.truckPayment;

  const fixedExpenses =
    truckPaymentWeekly +
    expenses.truckInsurance +
    expenses.trailerInsurance +
    expenses.trailerLease +
    expenses.iftaCost +
    expenses.adminFee;

  const perLoadExpenses = loads.reduce((sum, l) => {
    const commission = (l.earnings ?? 0) * (l.commissionRate ?? 0);
    return sum + (l.diesel ?? 0) + (l.def ?? 0) + commission;
  }, 0);

  const totalExpenses = fixedExpenses + perLoadExpenses;
  const milesDriven = expenses.endOdometer - expenses.startOdometer;
  const mileageDeduction = milesDriven * 0.14;
  const netProfit = totalEarnings - totalExpenses - mileageDeduction;

  return { weekKey, totalEarnings, totalExpenses, milesDriven, mileageDeduction, netProfit };
}

export function calcCompanyMileSummary(loads: LoadEntry[]): CompanyMileWeeklySummary {
  const weekKey = loads[0]?.weekKey ?? '';
  const totalEarnings = loads.reduce(
    (sum, l) => sum + (l.paidMileage ?? 0) * (l.centsPerMile ?? 0),
    0
  );
  return { weekKey, totalEarnings, netProfit: totalEarnings };
}

export function calcCompanyCommissionSummary(loads: LoadEntry[]): CompanyCommissionWeeklySummary {
  const weekKey = loads[0]?.weekKey ?? '';
  const totalEarnings = loads.reduce(
    (sum, l) => sum + (l.earnings ?? 0) * (l.commissionRate ?? 0),
    0
  );
  return { weekKey, totalEarnings, netProfit: totalEarnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/calculations.test.ts
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/calculations.ts __tests__/calculations.test.ts
git commit -m "feat: add calculation utilities with full test coverage"
```

---

## Task 5: Storage Helpers

**Files:**
- Create: `src/storage/storage.ts`
- Create: `__tests__/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// __tests__/storage.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveLoad,
  getLoadsForWeek,
  deleteLoad,
  saveWeeklyExpenses,
  getWeeklyExpenses,
  getAllWeekKeys,
} from '../src/storage/storage';
import type { LoadEntry, WeeklyExpenses } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

const sampleLoad: LoadEntry = {
  id: 'test-1',
  weekKey: '2026-05-25',
  driverType: 'owner-op',
  startLocation: 'TX',
  endLocation: 'CA',
  createdAt: '2026-05-25T10:00:00Z',
  earnings: 2500,
  commissionRate: 0.10,
  diesel: 350,
  def: 25,
};

describe('saveLoad / getLoadsForWeek', () => {
  it('saves and retrieves a load', async () => {
    await saveLoad(sampleLoad);
    const loads = await getLoadsForWeek('owner-op', '2026-05-25');
    expect(loads).toHaveLength(1);
    expect(loads[0].id).toBe('test-1');
  });

  it('returns empty array for unknown week', async () => {
    const loads = await getLoadsForWeek('owner-op', '2026-01-01');
    expect(loads).toHaveLength(0);
  });
});

describe('deleteLoad', () => {
  it('removes a load by id', async () => {
    await saveLoad(sampleLoad);
    await deleteLoad('owner-op', '2026-05-25', 'test-1');
    const loads = await getLoadsForWeek('owner-op', '2026-05-25');
    expect(loads).toHaveLength(0);
  });
});

describe('saveWeeklyExpenses / getWeeklyExpenses', () => {
  const expenses: WeeklyExpenses = {
    weekKey: '2026-05-25',
    truckPayment: 600, truckPaymentFrequency: 'weekly',
    truckInsurance: 250, trailerInsurance: 80,
    trailerLease: 200, iftaCost: 50, adminFee: 40,
    startOdometer: 100000, endOdometer: 103500,
  };

  it('saves and retrieves weekly expenses', async () => {
    await saveWeeklyExpenses(expenses);
    const result = await getWeeklyExpenses('2026-05-25');
    expect(result?.truckPayment).toBe(600);
  });

  it('returns null for unknown week', async () => {
    const result = await getWeeklyExpenses('2025-01-01');
    expect(result).toBeNull();
  });
});

describe('getAllWeekKeys', () => {
  it('returns distinct week keys for a driver type', async () => {
    await saveLoad({ ...sampleLoad, id: 'a', weekKey: '2026-05-25' });
    await saveLoad({ ...sampleLoad, id: 'b', weekKey: '2026-05-18' });
    const keys = await getAllWeekKeys('owner-op');
    expect(keys).toContain('2026-05-25');
    expect(keys).toContain('2026-05-18');
    expect(keys).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/storage.test.ts
```
Expected: FAIL — "Cannot find module '../src/storage/storage'"

- [ ] **Step 3: Implement storage helpers**

```typescript
// src/storage/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoadEntry, WeeklyExpenses } from '../types';

function loadsKey(driverType: string, weekKey: string) {
  return `loads:${driverType}:${weekKey}`;
}

function expensesKey(weekKey: string) {
  return `expenses:owner-op:${weekKey}`;
}

export async function saveLoad(load: LoadEntry): Promise<void> {
  const key = loadsKey(load.driverType, load.weekKey);
  const existing = await getLoadsForWeek(load.driverType, load.weekKey);
  const updated = [...existing.filter((l) => l.id !== load.id), load];
  await AsyncStorage.setItem(key, JSON.stringify(updated));
}

export async function getLoadsForWeek(
  driverType: string,
  weekKey: string
): Promise<LoadEntry[]> {
  const raw = await AsyncStorage.getItem(loadsKey(driverType, weekKey));
  return raw ? JSON.parse(raw) : [];
}

export async function deleteLoad(
  driverType: string,
  weekKey: string,
  loadId: string
): Promise<void> {
  const existing = await getLoadsForWeek(driverType, weekKey);
  const updated = existing.filter((l) => l.id !== loadId);
  await AsyncStorage.setItem(loadsKey(driverType, weekKey), JSON.stringify(updated));
}

export async function saveWeeklyExpenses(expenses: WeeklyExpenses): Promise<void> {
  await AsyncStorage.setItem(expensesKey(expenses.weekKey), JSON.stringify(expenses));
}

export async function getWeeklyExpenses(weekKey: string): Promise<WeeklyExpenses | null> {
  const raw = await AsyncStorage.getItem(expensesKey(weekKey));
  return raw ? JSON.parse(raw) : null;
}

export async function getAllWeekKeys(driverType: string): Promise<string[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `loads:${driverType}:`;
  return allKeys
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.replace(prefix, ''))
    .sort()
    .reverse();
}
```

- [ ] **Step 4: Run all tests to verify pass**

```bash
npx jest
```
Expected: PASS (all tests in weekKey, calculations, storage)

- [ ] **Step 5: Commit**

```bash
git add src/storage/storage.ts __tests__/storage.test.ts
git commit -m "feat: add AsyncStorage CRUD helpers with tests"
```

---

## Task 6: Shared UI Components

**Files:**
- Create: `src/components/CurrencyInput.tsx`
- Create: `src/components/CommissionSelector.tsx`
- Create: `src/components/SummaryCard.tsx`

- [ ] **Step 1: Create CurrencyInput**

```tsx
// src/components/CurrencyInput.tsx
import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
};

export function CurrencyInput({ label, value, onChangeText, placeholder = '0.00' }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Text style={styles.prefix}>$</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor="#999"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, color: '#555', marginBottom: 4, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, backgroundColor: '#fafafa',
  },
  prefix: { fontSize: 16, color: '#333', marginRight: 4 },
  input: { flex: 1, fontSize: 16, paddingVertical: 10, color: '#111' },
});
```

- [ ] **Step 2: Create CommissionSelector**

```tsx
// src/components/CommissionSelector.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  label: string;
  options: number[];   // e.g. [0.10, 0.12, 0.15]
  selected: number | null;
  onSelect: (v: number) => void;
};

export function CommissionSelector({ label, options, selected, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[styles.pill, selected === opt && styles.pillSelected]}
            onPress={() => onSelect(opt)}
          >
            <Text style={[styles.pillText, selected === opt && styles.pillTextSelected]}>
              {(opt * 100).toFixed(0)}%
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 14, color: '#555', marginBottom: 6, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f5f5f5',
  },
  pillSelected: { backgroundColor: '#1a3c6b', borderColor: '#1a3c6b' },
  pillText: { fontSize: 14, color: '#444' },
  pillTextSelected: { color: '#fff', fontWeight: '700' },
});
```

- [ ] **Step 3: Create SummaryCard**

```tsx
// src/components/SummaryCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Row = { label: string; value: string; highlight?: boolean };

type Props = { rows: Row[] };

export function SummaryCard({ rows }: Props) {
  return (
    <View style={styles.card}>
      {rows.map((row, i) => (
        <View key={i} style={[styles.row, i < rows.length - 1 && styles.rowBorder]}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.highlight && styles.highlight]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function fmt(n: number) {
  return `$${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export { fmt };

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff', borderRadius: 12,
    padding: 16, marginVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  label: { fontSize: 14, color: '#666' },
  value: { fontSize: 14, color: '#111', fontWeight: '600' },
  highlight: { color: '#1a6b3c', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: add CurrencyInput, CommissionSelector, SummaryCard components"
```

---

## Task 7: Navigation Setup

**Files:**
- Modify: `App.tsx`
- Create: `src/navigation/index.tsx`
- Create: `src/screens/HomeScreen.tsx` (stub)

- [ ] **Step 1: Create HomeScreen stub**

```tsx
// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Props = { navigation: NativeStackNavigationProp<any> };

export function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>TruckersPro</Text>
        <Text style={styles.subtitle}>Select your driver type</Text>

        {[
          { label: 'Owner Operator', route: 'OwnerOp' },
          { label: 'Company Driver — Per Mile', route: 'CompanyMile' },
          { label: 'Company Driver — Commission', route: 'CompanyCommission' },
        ].map(({ label, route }) => (
          <TouchableOpacity
            key={route}
            style={styles.card}
            onPress={() => navigation.navigate(route)}
          >
            <Text style={styles.cardText}>{label}</Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#1a3c6b', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 20,
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardText: { fontSize: 16, fontWeight: '600', color: '#222' },
  arrow: { fontSize: 20, color: '#1a3c6b' },
});
```

- [ ] **Step 2: Create navigation with tab stubs**

```tsx
// src/navigation/index.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { HomeScreen } from '../screens/HomeScreen';

// Owner Op screens (stubbed — replaced in later tasks)
import { OwnerOpDashboard } from '../screens/owner-op/OwnerOpDashboard';
import { OwnerOpAddLoad } from '../screens/owner-op/OwnerOpAddLoad';
import { OwnerOpWeeklyExpenses } from '../screens/owner-op/OwnerOpWeeklyExpenses';
import { OwnerOpHistory } from '../screens/owner-op/OwnerOpHistory';

// Company Mile screens
import { CompanyMileDashboard } from '../screens/company-mile/CompanyMileDashboard';
import { CompanyMileAddLoad } from '../screens/company-mile/CompanyMileAddLoad';
import { CompanyMileHistory } from '../screens/company-mile/CompanyMileHistory';

// Company Commission screens
import { CompanyCommissionDashboard } from '../screens/company-commission/CompanyCommissionDashboard';
import { CompanyCommissionAddLoad } from '../screens/company-commission/CompanyCommissionAddLoad';
import { CompanyCommissionHistory } from '../screens/company-commission/CompanyCommissionHistory';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function OwnerOpTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={OwnerOpDashboard} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="AddLoad" component={OwnerOpAddLoad} options={{ tabBarLabel: 'Add Load' }} />
      <Tab.Screen name="WeeklyExpenses" component={OwnerOpWeeklyExpenses} options={{ tabBarLabel: 'Expenses' }} />
      <Tab.Screen name="History" component={OwnerOpHistory} options={{ tabBarLabel: 'History' }} />
    </Tab.Navigator>
  );
}

function CompanyMileTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={CompanyMileDashboard} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="AddLoad" component={CompanyMileAddLoad} options={{ tabBarLabel: 'Add Load' }} />
      <Tab.Screen name="History" component={CompanyMileHistory} options={{ tabBarLabel: 'History' }} />
    </Tab.Navigator>
  );
}

function CompanyCommissionTabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Dashboard" component={CompanyCommissionDashboard} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="AddLoad" component={CompanyCommissionAddLoad} options={{ tabBarLabel: 'Add Load' }} />
      <Tab.Screen name="History" component={CompanyCommissionHistory} options={{ tabBarLabel: 'History' }} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="OwnerOp" component={OwnerOpTabs} options={{ title: 'Owner Operator' }} />
        <Stack.Screen name="CompanyMile" component={CompanyMileTabs} options={{ title: 'Company Driver — Per Mile' }} />
        <Stack.Screen name="CompanyCommission" component={CompanyCommissionTabs} options={{ title: 'Company Driver — Commission' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 3: Create all screen stubs** (needed so navigation compiles)

Create these 9 files, each with the same stub pattern — replace `ScreenName` with the actual name:

```tsx
// src/screens/owner-op/OwnerOpDashboard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
export function OwnerOpDashboard() {
  return <View style={s.c}><Text>Owner Op Dashboard</Text></View>;
}
const s = StyleSheet.create({ c: { flex: 1, justifyContent: 'center', alignItems: 'center' } });
```

Repeat for:
- `src/screens/owner-op/OwnerOpAddLoad.tsx` → export `OwnerOpAddLoad`
- `src/screens/owner-op/OwnerOpWeeklyExpenses.tsx` → export `OwnerOpWeeklyExpenses`
- `src/screens/owner-op/OwnerOpHistory.tsx` → export `OwnerOpHistory`
- `src/screens/company-mile/CompanyMileDashboard.tsx` → export `CompanyMileDashboard`
- `src/screens/company-mile/CompanyMileAddLoad.tsx` → export `CompanyMileAddLoad`
- `src/screens/company-mile/CompanyMileHistory.tsx` → export `CompanyMileHistory`
- `src/screens/company-commission/CompanyCommissionDashboard.tsx` → export `CompanyCommissionDashboard`
- `src/screens/company-commission/CompanyCommissionAddLoad.tsx` → export `CompanyCommissionAddLoad`
- `src/screens/company-commission/CompanyCommissionHistory.tsx` → export `CompanyCommissionHistory`

- [ ] **Step 4: Update App.tsx**

```tsx
// App.tsx
import React from 'react';
import { AppNavigator } from './src/navigation';

export default function App() {
  return <AppNavigator />;
}
```

- [ ] **Step 5: Verify navigation works in Expo Go**

```bash
npx expo start
```
Open in Expo Go. You should see the TruckersPro home screen with 3 cards. Tapping each card navigates into the tab navigator for that driver type with stub screens.

- [ ] **Step 6: Commit**

```bash
git add App.tsx src/navigation/ src/screens/
git commit -m "feat: wire up navigation with HomeScreen and tab navigators"
```

---

## Task 8: Owner Operator — Add Load Screen

**Files:**
- Modify: `src/screens/owner-op/OwnerOpAddLoad.tsx`

- [ ] **Step 1: Implement Add Load screen**

```tsx
// src/screens/owner-op/OwnerOpAddLoad.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyInput } from '../../components/CurrencyInput';
import { CommissionSelector } from '../../components/CommissionSelector';
import { saveLoad } from '../../storage/storage';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry } from '../../types';

export function OwnerOpAddLoad() {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [earnings, setEarnings] = useState('');
  const [diesel, setDiesel] = useState('');
  const [def, setDef] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | null>(null);

  const commissionAmount = commissionRate && earnings
    ? (parseFloat(earnings) * commissionRate).toFixed(2)
    : null;

  async function handleSave() {
    if (!startLocation || !endLocation || !earnings || !commissionRate) {
      Alert.alert('Missing fields', 'Please fill in all required fields and select a commission rate.');
      return;
    }
    const load: LoadEntry = {
      id: uuidv4(),
      weekKey: getCurrentWeekKey(),
      driverType: 'owner-op',
      startLocation,
      endLocation,
      createdAt: new Date().toISOString(),
      earnings: parseFloat(earnings),
      commissionRate,
      diesel: parseFloat(diesel) || 0,
      def: parseFloat(def) || 0,
    };
    await saveLoad(load);
    Alert.alert('Saved', 'Load added successfully.');
    setStartLocation(''); setEndLocation('');
    setEarnings(''); setDiesel(''); setDef('');
    setCommissionRate(null);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Add Load</Text>

        <Text style={s.label}>Starting State / Address</Text>
        <TextInput style={s.input} value={startLocation} onChangeText={setStartLocation} placeholder="e.g. TX or Dallas, TX" />

        <Text style={s.label}>End State / Address</Text>
        <TextInput style={s.input} value={endLocation} onChangeText={setEndLocation} placeholder="e.g. CA or Los Angeles, CA" />

        <CurrencyInput label="Earnings (Load Pay)" value={earnings} onChangeText={setEarnings} />
        <CurrencyInput label="Diesel Cost" value={diesel} onChangeText={setDiesel} />
        <CurrencyInput label="DEF Cost" value={def} onChangeText={setDef} />

        <CommissionSelector
          label="Commission Fee"
          options={[0.10, 0.12, 0.15]}
          selected={commissionRate}
          onSelect={setCommissionRate}
        />

        {commissionAmount && (
          <Text style={s.commCalc}>Commission: ${commissionAmount}</Text>
        )}

        <TouchableOpacity style={s.btn} onPress={handleSave}>
          <Text style={s.btnText}>Save Load</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 20 },
  label: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, marginBottom: 16, backgroundColor: '#fafafa', fontSize: 16,
  },
  commCalc: { color: '#1a6b3c', fontWeight: '600', marginBottom: 16, fontSize: 15 },
  btn: {
    backgroundColor: '#1a3c6b', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Install uuid package**

```bash
npm install uuid react-native-get-random-values
npm install --save-dev @types/uuid
```

Add this import at the very top of `App.tsx` (before all other imports):
```tsx
import 'react-native-get-random-values';
```

- [ ] **Step 3: Test in Expo Go**

Navigate to Owner Operator → Add Load. Fill in all fields, select a commission %, tap Save. Expected: alert "Load added successfully."

- [ ] **Step 4: Commit**

```bash
git add src/screens/owner-op/OwnerOpAddLoad.tsx App.tsx
git commit -m "feat: implement Owner Op Add Load screen"
```

---

## Task 9: Owner Operator — Weekly Expenses Screen

**Files:**
- Modify: `src/screens/owner-op/OwnerOpWeeklyExpenses.tsx`

- [ ] **Step 1: Implement Weekly Expenses screen**

```tsx
// src/screens/owner-op/OwnerOpWeeklyExpenses.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import { CurrencyInput } from '../../components/CurrencyInput';
import { saveWeeklyExpenses, getWeeklyExpenses } from '../../storage/storage';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { WeeklyExpenses } from '../../types';

export function OwnerOpWeeklyExpenses() {
  const weekKey = getCurrentWeekKey();
  const [truckPayment, setTruckPayment] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'monthly'>('weekly');
  const [truckInsurance, setTruckInsurance] = useState('');
  const [trailerInsurance, setTrailerInsurance] = useState('');
  const [trailerLease, setTrailerLease] = useState('');
  const [iftaCost, setIftaCost] = useState('');
  const [adminFee, setAdminFee] = useState('');
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');

  useEffect(() => {
    getWeeklyExpenses(weekKey).then((saved) => {
      if (!saved) return;
      setTruckPayment(String(saved.truckPayment));
      setFrequency(saved.truckPaymentFrequency);
      setTruckInsurance(String(saved.truckInsurance));
      setTrailerInsurance(String(saved.trailerInsurance));
      setTrailerLease(String(saved.trailerLease));
      setIftaCost(String(saved.iftaCost));
      setAdminFee(String(saved.adminFee));
      setStartOdometer(String(saved.startOdometer));
      setEndOdometer(String(saved.endOdometer));
    });
  }, []);

  async function handleSave() {
    const expenses: WeeklyExpenses = {
      weekKey,
      truckPayment: parseFloat(truckPayment) || 0,
      truckPaymentFrequency: frequency,
      truckInsurance: parseFloat(truckInsurance) || 0,
      trailerInsurance: parseFloat(trailerInsurance) || 0,
      trailerLease: parseFloat(trailerLease) || 0,
      iftaCost: parseFloat(iftaCost) || 0,
      adminFee: parseFloat(adminFee) || 0,
      startOdometer: parseFloat(startOdometer) || 0,
      endOdometer: parseFloat(endOdometer) || 0,
    };
    await saveWeeklyExpenses(expenses);
    Alert.alert('Saved', 'Weekly expenses updated.');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Weekly Expenses</Text>
        <Text style={s.week}>Week of {weekKey}</Text>

        <Text style={s.label}>Truck Payment</Text>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <CurrencyInput label="" value={truckPayment} onChangeText={setTruckPayment} />
          </View>
          <View style={s.toggle}>
            {(['weekly', 'monthly'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[s.toggleBtn, frequency === f && s.toggleActive]}
                onPress={() => setFrequency(f)}
              >
                <Text style={[s.toggleText, frequency === f && s.toggleTextActive]}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <CurrencyInput label="Truck Insurance (Weekly)" value={truckInsurance} onChangeText={setTruckInsurance} />
        <CurrencyInput label="Trailer Insurance (Weekly)" value={trailerInsurance} onChangeText={setTrailerInsurance} />
        <CurrencyInput label="Trailer Lease (Weekly)" value={trailerLease} onChangeText={setTrailerLease} />
        <CurrencyInput label="IFTA Sticker Cost (Weekly)" value={iftaCost} onChangeText={setIftaCost} />
        <CurrencyInput label="Admin Fee (Weekly)" value={adminFee} onChangeText={setAdminFee} />

        <Text style={s.section}>Mileage (Odometer)</Text>
        <Text style={s.label}>Starting Odometer</Text>
        <TextInput style={s.input} value={startOdometer} onChangeText={setStartOdometer} keyboardType="number-pad" placeholder="e.g. 100000" />
        <Text style={s.label}>Ending Odometer</Text>
        <TextInput style={s.input} value={endOdometer} onChangeText={setEndOdometer} keyboardType="number-pad" placeholder="e.g. 103500" />

        <TouchableOpacity style={s.btn} onPress={handleSave}>
          <Text style={s.btnText}>Save Expenses</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 4 },
  week: { color: '#888', marginBottom: 20 },
  label: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 4 },
  section: { fontSize: 16, fontWeight: '700', color: '#1a3c6b', marginTop: 8, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, marginBottom: 16, backgroundColor: '#fafafa', fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  toggle: { flexDirection: 'row', gap: 6 },
  toggleBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#ccc', backgroundColor: '#f5f5f5',
  },
  toggleActive: { backgroundColor: '#1a3c6b', borderColor: '#1a3c6b' },
  toggleText: { fontSize: 13, color: '#444' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  btn: { backgroundColor: '#1a3c6b', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Test in Expo Go**

Navigate to Owner Operator → Expenses. Fill in values, toggle weekly/monthly on truck payment, tap Save. Navigate away and come back — values should persist.

- [ ] **Step 3: Commit**

```bash
git add src/screens/owner-op/OwnerOpWeeklyExpenses.tsx
git commit -m "feat: implement Owner Op Weekly Expenses screen with persistence"
```

---

## Task 10: Owner Operator — Dashboard & History

**Files:**
- Modify: `src/screens/owner-op/OwnerOpDashboard.tsx`
- Modify: `src/screens/owner-op/OwnerOpHistory.tsx`

- [ ] **Step 1: Implement Dashboard**

```tsx
// src/screens/owner-op/OwnerOpDashboard.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SummaryCard, fmt } from '../../components/SummaryCard';
import { getLoadsForWeek, getWeeklyExpenses } from '../../storage/storage';
import { calcOwnerOpSummary } from '../../utils/calculations';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry, WeeklyExpenses } from '../../types';

const EMPTY_EXPENSES: WeeklyExpenses = {
  weekKey: '', truckPayment: 0, truckPaymentFrequency: 'weekly',
  truckInsurance: 0, trailerInsurance: 0, trailerLease: 0,
  iftaCost: 0, adminFee: 0, startOdometer: 0, endOdometer: 0,
};

export function OwnerOpDashboard() {
  const weekKey = getCurrentWeekKey();
  const [loads, setLoads] = useState<LoadEntry[]>([]);
  const [expenses, setExpenses] = useState<WeeklyExpenses>(EMPTY_EXPENSES);

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        getLoadsForWeek('owner-op', weekKey),
        getWeeklyExpenses(weekKey),
      ]).then(([l, e]) => {
        setLoads(l);
        setExpenses(e ?? { ...EMPTY_EXPENSES, weekKey });
      });
    }, [weekKey])
  );

  const summary = calcOwnerOpSummary(loads, expenses.weekKey ? expenses : { ...EMPTY_EXPENSES, weekKey });

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Owner Operator</Text>
        <Text style={s.week}>Week of {weekKey}</Text>
        <Text style={s.sub}>{loads.length} load{loads.length !== 1 ? 's' : ''} this week</Text>

        <SummaryCard rows={[
          { label: 'Total Earnings', value: fmt(summary.totalEarnings) },
          { label: 'Total Expenses', value: fmt(summary.totalExpenses) },
          { label: 'Miles Driven', value: `${summary.milesDriven.toLocaleString()} mi` },
          { label: 'Mileage Deduction ($0.14/mi)', value: fmt(summary.mileageDeduction) },
          { label: 'Net Profit', value: fmt(summary.netProfit), highlight: true },
        ]} />

        {loads.length > 0 && (
          <>
            <Text style={s.loadsTitle}>Loads This Week</Text>
            {loads.map((load) => (
              <View key={load.id} style={s.loadCard}>
                <Text style={s.loadRoute}>{load.startLocation} → {load.endLocation}</Text>
                <Text style={s.loadDetail}>Earnings: {fmt(load.earnings ?? 0)}</Text>
                <Text style={s.loadDetail}>Diesel: {fmt(load.diesel ?? 0)} | DEF: {fmt(load.def ?? 0)} | Commission: {((load.commissionRate ?? 0) * 100).toFixed(0)}%</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a3c6b' },
  week: { color: '#888', marginBottom: 4 },
  sub: { color: '#aaa', marginBottom: 16, fontSize: 13 },
  loadsTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 8 },
  loadCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  loadRoute: { fontWeight: '700', color: '#222', marginBottom: 4 },
  loadDetail: { color: '#666', fontSize: 13 },
});
```

- [ ] **Step 2: Implement History screen**

```tsx
// src/screens/owner-op/OwnerOpHistory.tsx
import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { SummaryCard, fmt } from '../../components/SummaryCard';
import { getLoadsForWeek, getWeeklyExpenses, getAllWeekKeys } from '../../storage/storage';
import { calcOwnerOpSummary } from '../../utils/calculations';
import type { WeeklyExpenses } from '../../types';

const EMPTY_EXPENSES: WeeklyExpenses = {
  weekKey: '', truckPayment: 0, truckPaymentFrequency: 'weekly',
  truckInsurance: 0, trailerInsurance: 0, trailerLease: 0,
  iftaCost: 0, adminFee: 0, startOdometer: 0, endOdometer: 0,
};

export function OwnerOpHistory() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, any>>({});

  useFocusEffect(
    useCallback(() => {
      getAllWeekKeys('owner-op').then(setWeeks);
    }, [])
  );

  async function loadWeek(weekKey: string) {
    if (expanded === weekKey) { setExpanded(null); return; }
    const [loads, expenses] = await Promise.all([
      getLoadsForWeek('owner-op', weekKey),
      getWeeklyExpenses(weekKey),
    ]);
    const summary = calcOwnerOpSummary(loads, expenses ?? { ...EMPTY_EXPENSES, weekKey });
    setSummaries((prev) => ({ ...prev, [weekKey]: summary }));
    setExpanded(weekKey);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>History</Text>
        {weeks.length === 0 && <Text style={s.empty}>No past weeks yet.</Text>}
        {weeks.map((wk) => (
          <TouchableOpacity key={wk} style={s.weekRow} onPress={() => loadWeek(wk)}>
            <Text style={s.weekLabel}>Week of {wk}</Text>
            <Text style={s.arrow}>{expanded === wk ? '▲' : '▼'}</Text>
            {expanded === wk && summaries[wk] && (
              <SummaryCard rows={[
                { label: 'Total Earnings', value: fmt(summaries[wk].totalEarnings) },
                { label: 'Total Expenses', value: fmt(summaries[wk].totalExpenses) },
                { label: 'Miles Driven', value: `${summaries[wk].milesDriven.toLocaleString()} mi` },
                { label: 'Mileage Deduction', value: fmt(summaries[wk].mileageDeduction) },
                { label: 'Net Profit', value: fmt(summaries[wk].netProfit), highlight: true },
              ]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 16 },
  empty: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  weekRow: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  weekLabel: { fontWeight: '600', color: '#333' },
  arrow: { position: 'absolute', right: 16, top: 16, color: '#888' },
});
```

- [ ] **Step 3: Test in Expo Go**

Add a few loads and expenses, then check the Dashboard — totals should calculate. Check History — past weeks should expand with summaries.

- [ ] **Step 4: Commit**

```bash
git add src/screens/owner-op/OwnerOpDashboard.tsx src/screens/owner-op/OwnerOpHistory.tsx
git commit -m "feat: implement Owner Op Dashboard and History screens"
```

---

## Task 11: Company Driver — Per Mile Screens

**Files:**
- Modify: `src/screens/company-mile/CompanyMileAddLoad.tsx`
- Modify: `src/screens/company-mile/CompanyMileDashboard.tsx`
- Modify: `src/screens/company-mile/CompanyMileHistory.tsx`

- [ ] **Step 1: Implement CompanyMileAddLoad**

```tsx
// src/screens/company-mile/CompanyMileAddLoad.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyInput } from '../../components/CurrencyInput';
import { saveLoad } from '../../storage/storage';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry } from '../../types';

export function CompanyMileAddLoad() {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [paidMileage, setPaidMileage] = useState('');
  const [centsPerMile, setCentsPerMile] = useState('');

  const loadEarnings = paidMileage && centsPerMile
    ? (parseFloat(paidMileage) * parseFloat(centsPerMile)).toFixed(2)
    : null;

  async function handleSave() {
    if (!startLocation || !endLocation || !paidMileage || !centsPerMile) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    const load: LoadEntry = {
      id: uuidv4(),
      weekKey: getCurrentWeekKey(),
      driverType: 'company-mile',
      startLocation, endLocation,
      createdAt: new Date().toISOString(),
      paidMileage: parseFloat(paidMileage),
      centsPerMile: parseFloat(centsPerMile),
    };
    await saveLoad(load);
    Alert.alert('Saved', 'Load added successfully.');
    setStartLocation(''); setEndLocation('');
    setPaidMileage(''); setCentsPerMile('');
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Add Load</Text>

        <Text style={s.label}>Starting State / Address</Text>
        <TextInput style={s.input} value={startLocation} onChangeText={setStartLocation} placeholder="e.g. TX" />

        <Text style={s.label}>End State / Address</Text>
        <TextInput style={s.input} value={endLocation} onChangeText={setEndLocation} placeholder="e.g. CA" />

        <Text style={s.label}>Paid Mileage</Text>
        <TextInput style={s.input} value={paidMileage} onChangeText={setPaidMileage} keyboardType="number-pad" placeholder="e.g. 500" />

        <CurrencyInput label="Paid Amount ($ per mile)" value={centsPerMile} onChangeText={setCentsPerMile} placeholder="0.55" />

        {loadEarnings && (
          <Text style={s.calc}>Load Earnings: ${loadEarnings}</Text>
        )}

        <TouchableOpacity style={s.btn} onPress={handleSave}>
          <Text style={s.btnText}>Save Load</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 20 },
  label: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, marginBottom: 16, backgroundColor: '#fafafa', fontSize: 16,
  },
  calc: { color: '#1a6b3c', fontWeight: '600', marginBottom: 16, fontSize: 15 },
  btn: { backgroundColor: '#1a3c6b', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Implement CompanyMileDashboard**

```tsx
// src/screens/company-mile/CompanyMileDashboard.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SummaryCard, fmt } from '../../components/SummaryCard';
import { getLoadsForWeek } from '../../storage/storage';
import { calcCompanyMileSummary } from '../../utils/calculations';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry } from '../../types';

export function CompanyMileDashboard() {
  const weekKey = getCurrentWeekKey();
  const [loads, setLoads] = useState<LoadEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getLoadsForWeek('company-mile', weekKey).then(setLoads);
    }, [weekKey])
  );

  const summary = loads.length > 0
    ? calcCompanyMileSummary(loads)
    : { totalEarnings: 0, netProfit: 0 };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Per Mile Driver</Text>
        <Text style={s.week}>Week of {weekKey}</Text>
        <Text style={s.sub}>{loads.length} load{loads.length !== 1 ? 's' : ''} this week</Text>

        <SummaryCard rows={[
          { label: 'Total Earnings', value: fmt(summary.totalEarnings) },
          { label: 'Net Profit', value: fmt(summary.netProfit), highlight: true },
        ]} />

        {loads.length > 0 && (
          <>
            <Text style={s.loadsTitle}>Loads This Week</Text>
            {loads.map((load) => (
              <View key={load.id} style={s.loadCard}>
                <Text style={s.loadRoute}>{load.startLocation} → {load.endLocation}</Text>
                <Text style={s.loadDetail}>{load.paidMileage} miles × ${load.centsPerMile?.toFixed(2)}/mi = {fmt((load.paidMileage ?? 0) * (load.centsPerMile ?? 0))}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a3c6b' },
  week: { color: '#888', marginBottom: 4 },
  sub: { color: '#aaa', marginBottom: 16, fontSize: 13 },
  loadsTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 8 },
  loadCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  loadRoute: { fontWeight: '700', color: '#222', marginBottom: 4 },
  loadDetail: { color: '#666', fontSize: 13 },
});
```

- [ ] **Step 3: Implement CompanyMileHistory**

```tsx
// src/screens/company-mile/CompanyMileHistory.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SummaryCard, fmt } from '../../components/SummaryCard';
import { getLoadsForWeek, getAllWeekKeys } from '../../storage/storage';
import { calcCompanyMileSummary } from '../../utils/calculations';

export function CompanyMileHistory() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, any>>({});

  useFocusEffect(
    useCallback(() => {
      getAllWeekKeys('company-mile').then(setWeeks);
    }, [])
  );

  async function loadWeek(weekKey: string) {
    if (expanded === weekKey) { setExpanded(null); return; }
    const loads = await getLoadsForWeek('company-mile', weekKey);
    const summary = loads.length > 0 ? calcCompanyMileSummary(loads) : { totalEarnings: 0, netProfit: 0 };
    setSummaries((prev) => ({ ...prev, [weekKey]: summary }));
    setExpanded(weekKey);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>History</Text>
        {weeks.length === 0 && <Text style={s.empty}>No past weeks yet.</Text>}
        {weeks.map((wk) => (
          <TouchableOpacity key={wk} style={s.weekRow} onPress={() => loadWeek(wk)}>
            <Text style={s.weekLabel}>Week of {wk}</Text>
            <Text style={s.arrow}>{expanded === wk ? '▲' : '▼'}</Text>
            {expanded === wk && summaries[wk] && (
              <SummaryCard rows={[
                { label: 'Total Earnings', value: fmt(summaries[wk].totalEarnings) },
                { label: 'Net Profit', value: fmt(summaries[wk].netProfit), highlight: true },
              ]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 16 },
  empty: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  weekRow: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  weekLabel: { fontWeight: '600', color: '#333' },
  arrow: { position: 'absolute', right: 16, top: 16, color: '#888' },
});
```

- [ ] **Step 4: Test in Expo Go**

Navigate to Company Driver — Per Mile. Add a load with mileage and rate. Check Dashboard shows correct earnings.

- [ ] **Step 5: Commit**

```bash
git add src/screens/company-mile/
git commit -m "feat: implement Company Per Mile screens"
```

---

## Task 12: Company Driver — Commission Screens

**Files:**
- Modify: `src/screens/company-commission/CompanyCommissionAddLoad.tsx`
- Modify: `src/screens/company-commission/CompanyCommissionDashboard.tsx`
- Modify: `src/screens/company-commission/CompanyCommissionHistory.tsx`

- [ ] **Step 1: Implement CompanyCommissionAddLoad**

```tsx
// src/screens/company-commission/CompanyCommissionAddLoad.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyInput } from '../../components/CurrencyInput';
import { CommissionSelector } from '../../components/CommissionSelector';
import { saveLoad } from '../../storage/storage';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry } from '../../types';

export function CompanyCommissionAddLoad() {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [earnings, setEarnings] = useState('');
  const [commissionRate, setCommissionRate] = useState<number | null>(null);

  const driverCut = commissionRate && earnings
    ? (parseFloat(earnings) * commissionRate).toFixed(2)
    : null;

  async function handleSave() {
    if (!startLocation || !endLocation || !earnings || !commissionRate) {
      Alert.alert('Missing fields', 'Please fill in all fields and select a commission rate.');
      return;
    }
    const load: LoadEntry = {
      id: uuidv4(),
      weekKey: getCurrentWeekKey(),
      driverType: 'company-commission',
      startLocation, endLocation,
      createdAt: new Date().toISOString(),
      earnings: parseFloat(earnings),
      commissionRate,
    };
    await saveLoad(load);
    Alert.alert('Saved', 'Load added successfully.');
    setStartLocation(''); setEndLocation('');
    setEarnings(''); setCommissionRate(null);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>Add Load</Text>

        <Text style={s.label}>Starting State / Address</Text>
        <TextInput style={s.input} value={startLocation} onChangeText={setStartLocation} placeholder="e.g. TX" />

        <Text style={s.label}>End State / Address</Text>
        <TextInput style={s.input} value={endLocation} onChangeText={setEndLocation} placeholder="e.g. FL" />

        <CurrencyInput label="Earnings (Load Pay)" value={earnings} onChangeText={setEarnings} />

        <CommissionSelector
          label="Commission Rate"
          options={[0.20, 0.25, 0.30, 0.35]}
          selected={commissionRate}
          onSelect={setCommissionRate}
        />

        {driverCut && (
          <Text style={s.calc}>Your Cut: ${driverCut}</Text>
        )}

        <TouchableOpacity style={s.btn} onPress={handleSave}>
          <Text style={s.btnText}>Save Load</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 20 },
  label: { fontSize: 14, color: '#555', fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 12, marginBottom: 16, backgroundColor: '#fafafa', fontSize: 16,
  },
  calc: { color: '#1a6b3c', fontWeight: '600', marginBottom: 16, fontSize: 15 },
  btn: { backgroundColor: '#1a3c6b', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Implement CompanyCommissionDashboard**

```tsx
// src/screens/company-commission/CompanyCommissionDashboard.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SummaryCard, fmt } from '../../components/SummaryCard';
import { getLoadsForWeek } from '../../storage/storage';
import { calcCompanyCommissionSummary } from '../../utils/calculations';
import { getCurrentWeekKey } from '../../utils/weekKey';
import type { LoadEntry } from '../../types';

export function CompanyCommissionDashboard() {
  const weekKey = getCurrentWeekKey();
  const [loads, setLoads] = useState<LoadEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      getLoadsForWeek('company-commission', weekKey).then(setLoads);
    }, [weekKey])
  );

  const summary = loads.length > 0
    ? calcCompanyCommissionSummary(loads)
    : { totalEarnings: 0, netProfit: 0 };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Commission Driver</Text>
        <Text style={s.week}>Week of {weekKey}</Text>
        <Text style={s.sub}>{loads.length} load{loads.length !== 1 ? 's' : ''} this week</Text>

        <SummaryCard rows={[
          { label: 'Total Earnings', value: fmt(summary.totalEarnings) },
          { label: 'Net Profit', value: fmt(summary.netProfit), highlight: true },
        ]} />

        {loads.length > 0 && (
          <>
            <Text style={s.loadsTitle}>Loads This Week</Text>
            {loads.map((load) => (
              <View key={load.id} style={s.loadCard}>
                <Text style={s.loadRoute}>{load.startLocation} → {load.endLocation}</Text>
                <Text style={s.loadDetail}>
                  {fmt(load.earnings ?? 0)} load × {((load.commissionRate ?? 0) * 100).toFixed(0)}% = {fmt((load.earnings ?? 0) * (load.commissionRate ?? 0))}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#1a3c6b' },
  week: { color: '#888', marginBottom: 4 },
  sub: { color: '#aaa', marginBottom: 16, fontSize: 13 },
  loadsTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginTop: 16, marginBottom: 8 },
  loadCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  loadRoute: { fontWeight: '700', color: '#222', marginBottom: 4 },
  loadDetail: { color: '#666', fontSize: 13 },
});
```

- [ ] **Step 3: Implement CompanyCommissionHistory**

```tsx
// src/screens/company-commission/CompanyCommissionHistory.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SummaryCard, fmt } from '../../components/SummaryCard';
import { getLoadsForWeek, getAllWeekKeys } from '../../storage/storage';
import { calcCompanyCommissionSummary } from '../../utils/calculations';

export function CompanyCommissionHistory() {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, any>>({});

  useFocusEffect(
    useCallback(() => {
      getAllWeekKeys('company-commission').then(setWeeks);
    }, [])
  );

  async function loadWeek(weekKey: string) {
    if (expanded === weekKey) { setExpanded(null); return; }
    const loads = await getLoadsForWeek('company-commission', weekKey);
    const summary = loads.length > 0 ? calcCompanyCommissionSummary(loads) : { totalEarnings: 0, netProfit: 0 };
    setSummaries((prev) => ({ ...prev, [weekKey]: summary }));
    setExpanded(weekKey);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>History</Text>
        {weeks.length === 0 && <Text style={s.empty}>No past weeks yet.</Text>}
        {weeks.map((wk) => (
          <TouchableOpacity key={wk} style={s.weekRow} onPress={() => loadWeek(wk)}>
            <Text style={s.weekLabel}>Week of {wk}</Text>
            <Text style={s.arrow}>{expanded === wk ? '▲' : '▼'}</Text>
            {expanded === wk && summaries[wk] && (
              <SummaryCard rows={[
                { label: 'Total Earnings', value: fmt(summaries[wk].totalEarnings) },
                { label: 'Net Profit', value: fmt(summaries[wk].netProfit), highlight: true },
              ]} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f2f4f8' },
  container: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#1a3c6b', marginBottom: 16 },
  empty: { color: '#aaa', textAlign: 'center', marginTop: 40 },
  weekRow: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
  },
  weekLabel: { fontWeight: '600', color: '#333' },
  arrow: { position: 'absolute', right: 16, top: 16, color: '#888' },
});
```

- [ ] **Step 4: Test in Expo Go**

Navigate to Company Driver — Commission. Add a load, select a commission %, check that the Dashboard shows the correct driver cut.

- [ ] **Step 5: Commit**

```bash
git add src/screens/company-commission/
git commit -m "feat: implement Company Commission screens"
```

---

## Task 13: Run Full Test Suite & Final Expo Go Verification

- [ ] **Step 1: Run all tests**

```bash
npx jest --coverage
```
Expected: All tests pass. Coverage report shows utils and storage at 100%.

- [ ] **Step 2: Start Expo and do a full walkthrough**

```bash
npx expo start
```

Walk through this checklist on your iPhone via Expo Go:
1. Home screen shows 3 driver type cards
2. **Owner Operator:** Add 2 loads with different commission rates → Dashboard shows sum, correct commission deductions, mileage deduction applied to net profit
3. **Owner Operator:** Fill in Weekly Expenses → Dashboard net profit updates
4. **Owner Operator:** History shows the current week, expands to show summary
5. **Company Driver — Per Mile:** Add 2 loads → Dashboard shows total miles × rate
6. **Company Driver — Commission:** Add 2 loads with different rates → Dashboard shows correct driver cuts
7. Close Expo Go entirely, reopen → all data persists

- [ ] **Step 3: Commit final state**

```bash
git add .
git commit -m "feat: complete TruckersPro v1 demo — all screens and tests passing"
```
