# Signup + Password Auth + Dribbble Dark Theme — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace OTP auth with email+password, lock each account to a single driver type chosen at signup, drop HomeScreen in favor of direct routing into the user's tabs, and re-skin the entire app in a Dribbble-inspired dark theme with yellow accents.

**Architecture:** Single `profiles` row per user holds the locked driver type. App.tsx reads it post-auth and mounts the matching tab navigator directly. Dark theme via a rewritten `theme.ts` and a new `ScreenHeader` + custom `TabBar` shared across all screens.

**Tech Stack:** React Native / Expo SDK 54, `@supabase/supabase-js`, `@react-navigation` (Stack + bottom-tabs with custom tab bar), `react-native-safe-area-context`.

**Spec:** [docs/superpowers/specs/2026-05-26-signup-password-and-dribbble-theme-design.md](../specs/2026-05-26-signup-password-and-dribbble-theme-design.md)

---

## Task 1: Wipe Supabase data + restructure profiles table (manual)

**Files:**
- Create: `src/supabase/schema-v2.sql`

- [ ] **Step 1: Create the SQL file**

Create `src/supabase/schema-v2.sql` with:

```sql
-- v2: switch profiles to one-row-per-user, lock driver_type per account
-- Wipe existing test data first (per spec: existing user goes through fresh signup)

delete from loads;
delete from fuel_entries;
delete from weekly_expenses;
drop table if exists profiles;
delete from auth.users;

create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  driver_type text not null check (driver_type in
    ('owner-op', 'lease', 'company-mile', 'company-commission')),
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy "own row" on profiles for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- [ ] **Step 2: Ask the user to run the SQL**

Prompt the user:

> Run `src/supabase/schema-v2.sql` in your Supabase dashboard → SQL Editor → New query → paste contents → Run. This wipes existing test data and rebuilds the `profiles` table with a single-row-per-user shape. Also: go to Authentication → Providers → Email → enable "Confirm email" set to OFF (autoconfirm signups). Reply "done" when complete.
>
> (If you'd rather give me a fresh Supabase access token I can do it via the management API.)

Wait for confirmation.

- [ ] **Step 3: Commit the SQL file**

```bash
git add src/supabase/schema-v2.sql
git commit -m "feat(db): schema v2 — single-row profiles with locked driver_type"
```

---

## Task 2: Theme rewrite

**Files:**
- Modify: `src/theme.ts` (full rewrite)

- [ ] **Step 1: Read the current `src/theme.ts`** to see what's exported (likely `C` and `shadow`).

- [ ] **Step 2: Replace `src/theme.ts` with the new dark palette**

```ts
export const C = {
  // Backgrounds
  bg: '#0F1419',
  card: '#1A1F26',
  cardElevated: '#222831',
  inputBg: '#1A1F26',

  // Accent (yellow) — the only non-grayscale color in the UI
  accent: '#FFD600',
  accentText: '#0F1419',

  // Text
  text: '#FFFFFF',
  sub: '#9CA3AF',
  muted: '#6B7280',

  // Borders / dividers
  border: '#2A3038',

  // Status
  danger: '#EF4444',
  success: '#34D399',

  // Backwards-compat aliases (existing screens still reference these — point at new tokens)
  gradStart: '#1A1F26',
  gradEnd: '#FFD600',
};

export const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.4,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no NEW errors. The `gradStart`/`gradEnd` aliases keep existing `LinearGradient` callers compiling for now; they'll be removed as screens get restyled.

- [ ] **Step 4: Commit**

```bash
git add src/theme.ts
git commit -m "feat(theme): switch to Dribbble-inspired dark palette with yellow accent"
```

---

## Task 3: Add SafeAreaProvider to App root

**Files:**
- Modify: `App.tsx` — wrap top-level render in `<SafeAreaProvider>`

- [ ] **Step 1: Verify `react-native-safe-area-context` is installed**

Run: `node -e "console.log(require('react-native-safe-area-context/package.json').version)"`
Expected: a version string (it's a transitive dep of `@react-navigation`). If "Cannot find module", run:
`npm install react-native-safe-area-context --legacy-peer-deps`

- [ ] **Step 2: Wrap App.tsx in SafeAreaProvider**

Open `App.tsx`. Add at the top with the other imports:

```ts
import { SafeAreaProvider } from 'react-native-safe-area-context';
```

Wrap the entire returned JSX in `<SafeAreaProvider>`. For example, the outermost render condition (currently `if (authState === 'loading' || authState === 'migrating') return <View>...`) becomes:

```tsx
return (
  <SafeAreaProvider>
    {(() => {
      // existing if/else if/else if/else logic returning the right screen
      if (authState === 'loading' || authState === 'migrating') {
        return <View style={s.center}>...</View>;
      }
      // ...etc, then final WeekProvider+AppNavigator
    })()}
  </SafeAreaProvider>
);
```

Or refactor to a single return at the bottom that uses a `let content` variable. Pick the cleaner option.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add App.tsx package.json package-lock.json
git commit -m "feat(layout): wrap app in SafeAreaProvider for reliable insets"
```

---

## Task 4: Storage profile API simplification (TDD)

**Files:**
- Modify: `src/storage/storage.ts`
- Modify: `__tests__/storage.test.ts`

The current `saveProfileName(driverType, name)` / `getProfileName(driverType)` take a `driverType` param. With one profile per user, this becomes unnecessary.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/storage.test.ts`:

```ts
describe('profile API v2 (no driverType arg)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('saveProfileName / getProfileName round-trip without driverType arg', async () => {
    const { saveProfileName, getProfileName } = require('../src/storage/storage');
    await saveProfileName('Fatih');
    const got = await getProfileName();
    expect(got).toBe('Fatih');
  });

  test('saveDriverType / getDriverType round-trip', async () => {
    const { saveDriverType, getDriverType } = require('../src/storage/storage');
    await saveDriverType('owner-op');
    const got = await getDriverType();
    expect(got).toBe('owner-op');
  });

  test('getDriverType returns null when unset', async () => {
    const { getDriverType } = require('../src/storage/storage');
    const got = await getDriverType();
    expect(got).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest __tests__/storage.test.ts -t "profile API v2"`
Expected: FAIL — `saveDriverType` / `getDriverType` don't exist; `saveProfileName`/`getProfileName` won't accept no args.

- [ ] **Step 3: Update `src/storage/storage.ts`**

Replace the existing `saveProfileName` / `getProfileName` block with:

```ts
const PROFILE_NAME_KEY = 'profile:name';
const PROFILE_DRIVER_TYPE_KEY = 'profile:driver_type';

export async function saveProfileName(name: string): Promise<void> {
  await AsyncStorage.setItem(PROFILE_NAME_KEY, name);
  await syncEngine.enqueue({ kind: 'upsertProfile', payload: { name } });
}

export async function getProfileName(): Promise<string> {
  return (await AsyncStorage.getItem(PROFILE_NAME_KEY)) ?? '';
}

export async function saveDriverType(driverType: string): Promise<void> {
  await AsyncStorage.setItem(PROFILE_DRIVER_TYPE_KEY, driverType);
}

export async function getDriverType(): Promise<string | null> {
  return await AsyncStorage.getItem(PROFILE_DRIVER_TYPE_KEY);
}
```

Note: `saveDriverType` is local-only; the driver-type column is written to Supabase directly during signup (not via the queue) per spec.

Also: keep the legacy key prefix `profile:owner-op:name` migration-compatible by reading both in `getProfileName` if needed. For v2 we're starting fresh (wipe), so just use the new key.

- [ ] **Step 4: Update existing callers of `saveProfileName` / `getProfileName`**

Search for callers:

Run: `grep -rn "saveProfileName\|getProfileName" src/`

Expected callers: `OwnerOpDashboard.tsx`, possibly `CompanyMileDashboard.tsx`, `CompanyCommissionDashboard.tsx`.

For each caller, remove the `driverType` argument:
- `saveProfileName(driverType, name)` → `saveProfileName(name)`
- `getProfileName(driverType)` → `getProfileName()`

- [ ] **Step 5: Run all storage tests**

Run: `npx jest __tests__/storage.test.ts`
Expected: PASS (existing + new tests).

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/storage/storage.ts __tests__/storage.test.ts src/screens/owner-op/OwnerOpDashboard.tsx src/screens/company-mile/CompanyMileDashboard.tsx src/screens/company-commission/CompanyCommissionDashboard.tsx
git commit -m "feat(storage): one-row-per-user profile API (saveProfileName(name), getDriverType)"
```

---

## Task 5: Sync engine upsertProfile payload update (TDD)

**Files:**
- Modify: `src/sync/types.ts`
- Modify: `src/sync/syncEngine.ts`
- Modify: `__tests__/syncEngine.test.ts`

- [ ] **Step 1: Update the SyncOp type**

In `src/sync/types.ts`, change:

```ts
| { kind: 'upsertProfile'; payload: { driverType: string; name: string } };
```

to:

```ts
| { kind: 'upsertProfile'; payload: { name: string } };
```

- [ ] **Step 2: Update the dispatcher**

In `src/sync/syncEngine.ts`, find the `case 'upsertProfile':` block. Replace it with:

```ts
case 'upsertProfile': {
  const { error } = await supabase.from('profiles').update({
    name: op.payload.name,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);
  if (error) throw new Error(error.message);
  return;
}
```

Note: switched from `upsert` to `update` because the profile row is guaranteed to exist (created at signup with driver_type). Using `update` avoids the risk of overwriting the driver_type with null.

- [ ] **Step 3: Update the existing upsertProfile test**

Find any test in `__tests__/syncEngine.test.ts` that references `upsertProfile`. If none exists, add this:

```ts
test('upsertProfile sends UPDATE with name only', async () => {
  const updateMock = jest.fn().mockReturnValue({ eq: jest.fn(() => Promise.resolve({ error: null })) });
  const fromMock = jest.fn(() => ({ update: updateMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(fromMock);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  await syncEngine.enqueue({
    kind: 'upsertProfile',
    payload: { name: 'Fatih' },
  });

  await syncEngine.flush();

  expect(fromMock).toHaveBeenCalledWith('profiles');
  expect(updateMock).toHaveBeenCalledTimes(1);
  const arg = updateMock.mock.calls[0][0];
  expect(arg.name).toBe('Fatih');
  expect(arg.driver_type).toBeUndefined();
});
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/syncEngine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sync/types.ts src/sync/syncEngine.ts __tests__/syncEngine.test.ts
git commit -m "feat(sync): upsertProfile sends UPDATE name-only (driver_type is immutable)"
```

---

## Task 6: pullFromSupabase reads new profile shape (TDD)

**Files:**
- Modify: `src/storage/storage.ts` — `pullFromSupabase` function
- Modify: `__tests__/migration.test.ts`

- [ ] **Step 1: Append a failing test to `__tests__/migration.test.ts`**

```ts
test('pullFromSupabase writes both driver_type and name from profile row', async () => {
  const { supabase } = require('../src/supabase/client');
  const selectChain = (data: any[]) => ({
    select: () => ({ eq: () => Promise.resolve({ data, error: null }) }),
  });
  supabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return selectChain([{
        user_id: 'user-1',
        driver_type: 'lease',
        name: 'Test Driver',
      }]);
    }
    return selectChain([]);
  });

  const { pullFromSupabase } = require('../src/storage/storage');
  await pullFromSupabase('user-1');

  expect(await AsyncStorage.getItem('profile:name')).toBe('Test Driver');
  expect(await AsyncStorage.getItem('profile:driver_type')).toBe('lease');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/migration.test.ts -t "pullFromSupabase writes both"`
Expected: FAIL — likely writes to old `profile:{driverType}:name` key.

- [ ] **Step 3: Update `pullFromSupabase` in `src/storage/storage.ts`**

Find the section that writes profile data. Replace with:

```ts
// Profiles (single row per user with driver_type + name)
for (const row of profRes.data ?? []) {
  await AsyncStorage.setItem(PROFILE_NAME_KEY, row.name ?? '');
  await AsyncStorage.setItem(PROFILE_DRIVER_TYPE_KEY, row.driver_type);
}
```

If `PROFILE_NAME_KEY` / `PROFILE_DRIVER_TYPE_KEY` weren't exported from the module's top, define them at module scope so they're shared with the save/get functions added in Task 4.

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/migration.test.ts`
Expected: PASS (all migration tests).

- [ ] **Step 5: Commit**

```bash
git add src/storage/storage.ts __tests__/migration.test.ts
git commit -m "feat(storage): pullFromSupabase writes profile:name + profile:driver_type"
```

---

## Task 7: Extract signOut utility

**Files:**
- Create: `src/utils/signOut.ts`
- Modify: `src/screens/HomeScreen.tsx` (use the util — temporary; this screen is deleted in a later task)

- [ ] **Step 1: Create `src/utils/signOut.ts`** with:

```ts
import { Alert } from 'react-native';
import { supabase } from '../supabase/client';
import { syncEngine } from '../sync/syncEngine';
import { wipeAll } from '../storage/storage';

export function confirmAndSignOut(): void {
  Alert.alert('Sign out', 'Sign out of your account?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Sign out',
      style: 'destructive',
      onPress: async () => {
        syncEngine.stop();
        await supabase.auth.signOut();
        await wipeAll();
      },
    },
  ]);
}
```

- [ ] **Step 2: Update `src/screens/HomeScreen.tsx`**

Replace the inline `handleSignOut` function with a call to the util. Find the `<TouchableOpacity onPress={handleSignOut}>` and either keep `handleSignOut` as a one-line wrapper:

```ts
import { confirmAndSignOut } from '../utils/signOut';
// ...
const handleSignOut = confirmAndSignOut;
```

Or replace `onPress={handleSignOut}` with `onPress={confirmAndSignOut}` and delete the local function entirely.

Also: remove the now-unused imports (`Alert`, `supabase`, `syncEngine`, `wipeAll` if only the handler used them).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/signOut.ts src/screens/HomeScreen.tsx
git commit -m "refactor: extract confirmAndSignOut into reusable util"
```

---

## Task 8: ScreenHeader shared component

**Files:**
- Create: `src/components/ScreenHeader.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React, { ReactNode } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  showLogo?: boolean;
};

export function ScreenHeader({ title, subtitle, left, right, showLogo = true }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      <View style={s.row}>
        {left ?? (showLogo ? (
          <Image source={require('../../Logo.jpeg')} style={s.logo} resizeMode="contain" />
        ) : null)}
        <View style={s.middle}>
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right ?? <View style={{ width: 28 }} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: C.bg, paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 28, height: 28, borderRadius: 8 },
  middle: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 12, fontWeight: '500', color: C.sub, marginTop: 2 },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ScreenHeader.tsx
git commit -m "feat(ui): add ScreenHeader shared component with logo + safe-area"
```

---

## Task 9: SignOutButton component

**Files:**
- Create: `src/components/SignOutButton.tsx`

- [ ] **Step 1: Create the button**

```tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { confirmAndSignOut } from '../utils/signOut';
import { C } from '../theme';

export function SignOutButton() {
  return (
    <TouchableOpacity
      onPress={confirmAndSignOut}
      style={s.btn}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="log-out-outline" size={16} color={C.text} />
      <Text style={s.text}>Sign out</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: C.card, borderRadius: 999,
  },
  text: { color: C.text, fontSize: 12, fontWeight: '700' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SignOutButton.tsx
git commit -m "feat(ui): add SignOutButton component"
```

---

## Task 10: DriverTypeGrid component

**Files:**
- Create: `src/components/DriverTypeGrid.tsx`

Used by SignupScreen and PickDriverTypeScreen.

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';

export type DriverTypeChoice = 'owner-op' | 'lease' | 'company-mile' | 'company-commission';

const OPTIONS: { value: DriverTypeChoice; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'owner-op',           label: 'Owner Op',     icon: 'car-sport-outline' },
  { value: 'lease',              label: 'Lease',        icon: 'key-outline' },
  { value: 'company-mile',       label: 'Company $/mi', icon: 'speedometer-outline' },
  { value: 'company-commission', label: 'Company %',    icon: 'briefcase-outline' },
];

type Props = {
  selected: DriverTypeChoice | null;
  onSelect: (v: DriverTypeChoice) => void;
};

export function DriverTypeGrid({ selected, onSelect }: Props) {
  return (
    <View style={s.grid}>
      {OPTIONS.map((opt) => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[s.cell, active && s.cellActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={opt.icon}
              size={28}
              color={active ? C.accentText : C.text}
            />
            <Text style={[s.label, active && s.labelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: {
    flexBasis: '47%',
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
    gap: 10,
    minHeight: 100,
  },
  cellActive: {
    backgroundColor: C.accent,
  },
  label: { color: C.text, fontSize: 13, fontWeight: '700' },
  labelActive: { color: C.accentText },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DriverTypeGrid.tsx
git commit -m "feat(ui): add DriverTypeGrid 2x2 picker"
```

---

## Task 11: WelcomeScreen

**Files:**
- Create: `src/screens/WelcomeScreen.tsx`
- Modify: `.gitignore` — ensure `assets/welcome-bg.jpg` requirement is documented

This screen needs an image at `assets/welcome-bg.jpg`. The user will supply it. If it doesn't exist yet, fall back to a solid gradient so the build doesn't crash.

- [ ] **Step 1: Check if `assets/welcome-bg.jpg` exists**

Run: `ls assets/welcome-bg.jpg 2>/dev/null || echo "MISSING"`

If MISSING, pause and ask the user:

> The WelcomeScreen needs a background photo at `assets/welcome-bg.jpg`. Drop your truck/road photo there (any landscape JPG), then reply "done". If you don't have one yet, I'll use a placeholder gradient and you can swap it in later.

If the user replies they'll add it later, proceed with a placeholder using the existing `Logo.jpeg` as a dim background (`opacity: 0.15`) over a dark gradient — temporary.

- [ ] **Step 2: Create `src/screens/WelcomeScreen.tsx`**

```tsx
import React from 'react';
import { View, Text, ImageBackground, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

type Props = { navigation: any };

export function WelcomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={require('../../assets/welcome-bg.jpg')}
        style={s.bg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(15,20,25,0)', 'rgba(15,20,25,0.4)', 'rgba(15,20,25,0.95)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />

        <View style={[s.content, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={s.title}>Drive smart.{'\n'}Track every mile.</Text>

          <View style={s.dots}>
            <View style={[s.dot, s.dotActive]} />
            <View style={s.dot} />
            <View style={s.dot} />
          </View>

          <View style={s.buttonRow}>
            <TouchableOpacity
              style={s.button}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Text style={s.buttonText}>Log in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.button}
              onPress={() => navigation.navigate('Signup')}
              activeOpacity={0.85}
            >
              <Text style={s.buttonText}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  bg: { flex: 1, justifyContent: 'flex-end' },
  content: { padding: 24, gap: 28 },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', lineHeight: 42 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 22, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { backgroundColor: '#fff', width: 32 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 3: If the image is missing, use a fallback**

Change `source={require('../../assets/welcome-bg.jpg')}` to a conditional. Since `require()` is static, the cleanest fallback is to add a small `try/catch` wrapper around an `<Image>` OR simply use a `<View>` with a dark gradient when the file doesn't exist. For simplicity in v1: if the user hasn't dropped a file, create `assets/welcome-bg.jpg` as a copy of `Logo.jpeg` so the require resolves:

Run (only if welcome-bg.jpg is missing):
```bash
cp Logo.jpeg assets/welcome-bg.jpg
```

The user can replace it later.

- [ ] **Step 4: Commit**

```bash
git add src/screens/WelcomeScreen.tsx assets/welcome-bg.jpg
git commit -m "feat(auth): add WelcomeScreen with background image + Log in / Sign up buttons"
```

---

## Task 12: LoginScreen

**Files:**
- Create: `src/screens/LoginScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, StatusBar, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase/client';
import { C } from '../theme';

type Props = { navigation: any };

export function LoginScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 1) {
      setError('Enter your password.');
      return;
    }
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    });
    setSubmitting(false);
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message);
      return;
    }
    // Session set; App.tsx auth listener will route us.
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>

          <View style={s.hero}>
            <Image source={require('../../Logo.jpeg')} style={s.logo} resizeMode="contain" />
            <Text style={s.appName}>TruckersPro</Text>
            <Text style={s.tagline}>Welcome back</Text>
          </View>

          <View style={s.form}>
            <Text style={s.label}>EMAIL</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.sub} />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            </View>

            <Text style={s.label}>PASSWORD</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
                autoComplete="password"
              />
              <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.sub} />
              </TouchableOpacity>
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSignIn}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>{submitting ? 'Signing in…' : 'Sign In'}</Text>
              <Ionicons name="arrow-forward" size={20} color={C.accentText} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={s.linkBtn}>
              <Text style={s.linkText}>
                Don't have an account?  <Text style={s.linkAccent}>Sign up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, gap: 24 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 6 },
  logo: { width: 80, height: 80, borderRadius: 20 },
  appName: { fontSize: 28, fontWeight: '800', color: C.text, marginTop: 8 },
  tagline: { fontSize: 14, fontWeight: '500', color: C.sub },
  form: { gap: 12 },
  label: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginTop: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16,
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
  error: { color: C.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 12,
  },
  primaryBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: C.sub, fontSize: 14 },
  linkAccent: { color: C.accent, fontWeight: '700' },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/LoginScreen.tsx
git commit -m "feat(auth): add LoginScreen (email + password)"
```

---

## Task 13: SignupScreen

**Files:**
- Create: `src/screens/SignupScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, KeyboardAvoidingView, Platform, StatusBar, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase/client';
import { DriverTypeGrid, DriverTypeChoice } from '../components/DriverTypeGrid';
import { saveDriverType } from '../storage/storage';
import { C } from '../theme';

type Props = { navigation: any };

export function SignupScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [driverType, setDriverType] = useState<DriverTypeChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don\'t match.');
      return;
    }
    if (!driverType) {
      setError('Please pick a driver type.');
      return;
    }

    setSubmitting(true);
    const { data, error: signErr } = await supabase.auth.signUp({
      email: trimmed,
      password,
    });
    if (signErr || !data.user) {
      setSubmitting(false);
      setError(
        signErr?.message?.includes('already')
          ? 'An account with this email already exists. Try signing in.'
          : signErr?.message ?? 'Sign up failed.'
      );
      return;
    }

    // Insert profile row directly (not via queue — App.tsx needs it to exist before bootstrap).
    const { error: profErr } = await supabase.from('profiles').insert({
      user_id: data.user.id,
      driver_type: driverType,
      name: '',
    });
    if (profErr) {
      setSubmitting(false);
      setError('Account created but profile setup failed. Please sign in.');
      return;
    }

    // Save locally so bootstrap can read it immediately
    await saveDriverType(driverType);
    setSubmitting(false);
    // Session set; App.tsx will pick up SIGNED_IN.
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={C.text} />
          </TouchableOpacity>

          <View style={s.hero}>
            <Image source={require('../../Logo.jpeg')} style={s.logo} resizeMode="contain" />
            <Text style={s.appName}>Create account</Text>
            <Text style={s.tagline}>Pick your driver type below</Text>
          </View>

          <View style={s.form}>
            <Text style={s.label}>EMAIL</Text>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={C.sub} />
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={C.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
              />
            </View>

            <Text style={s.label}>PASSWORD</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPwd((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.sub} />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>CONFIRM PASSWORD</Text>
            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={C.sub} />
              <TextInput
                style={s.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter password"
                placeholderTextColor={C.muted}
                secureTextEntry={!showPwd}
                autoCapitalize="none"
              />
            </View>

            <Text style={[s.label, { marginTop: 16 }]}>I AM A...</Text>
            <DriverTypeGrid selected={driverType} onSelect={setDriverType} />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnText}>{submitting ? 'Creating…' : 'Create Account'}</Text>
              <Ionicons name="arrow-forward" size={20} color={C.accentText} />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.linkBtn}>
              <Text style={s.linkText}>
                Already have an account?  <Text style={s.linkAccent}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, gap: 20 },
  back: { width: 40, height: 40, justifyContent: 'center' },
  hero: { alignItems: 'center', gap: 6 },
  logo: { width: 80, height: 80, borderRadius: 20 },
  appName: { fontSize: 26, fontWeight: '800', color: C.text, marginTop: 8 },
  tagline: { fontSize: 14, fontWeight: '500', color: C.sub },
  form: { gap: 12 },
  label: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5, marginTop: 8 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 16,
    paddingHorizontal: 16,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
  error: { color: C.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 16,
  },
  primaryBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
  linkBtn: { alignItems: 'center', marginTop: 16 },
  linkText: { color: C.sub, fontSize: 14 },
  linkAccent: { color: C.accent, fontWeight: '700' },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/screens/SignupScreen.tsx
git commit -m "feat(auth): add SignupScreen (email + password + driver type)"
```

---

## Task 14: PickDriverTypeScreen (edge case)

**Files:**
- Create: `src/screens/PickDriverTypeScreen.tsx`

Used when a signed-in user has no profile row (e.g., signup interrupted between auth.signUp and profile insert).

- [ ] **Step 1: Create the screen**

```tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, StatusBar, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../supabase/client';
import { DriverTypeGrid, DriverTypeChoice } from '../components/DriverTypeGrid';
import { saveDriverType } from '../storage/storage';
import { C } from '../theme';

type Props = { userId: string; onDone: () => void };

export function PickDriverTypeScreen({ userId, onDone }: Props) {
  const insets = useSafeAreaInsets();
  const [driverType, setDriverType] = useState<DriverTypeChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!driverType) { setError('Pick a driver type.'); return; }
    setSubmitting(true);
    const { error: err } = await supabase.from('profiles').insert({
      user_id: userId,
      driver_type: driverType,
      name: '',
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    await saveDriverType(driverType);
    onDone();
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.hero}>
          <Image source={require('../../Logo.jpeg')} style={s.logo} resizeMode="contain" />
          <Text style={s.appName}>Welcome to TruckersPro</Text>
          <Text style={s.tagline}>Pick your driver type to continue</Text>
        </View>

        <DriverTypeGrid selected={driverType} onSelect={setDriverType} />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[s.primaryBtn, submitting && { opacity: 0.6 }]}
          onPress={handleContinue}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={s.primaryBtnText}>{submitting ? 'Saving…' : 'Continue'}</Text>
          <Ionicons name="arrow-forward" size={20} color={C.accentText} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, gap: 20 },
  hero: { alignItems: 'center', gap: 6, marginBottom: 16 },
  logo: { width: 80, height: 80, borderRadius: 20 },
  appName: { fontSize: 24, fontWeight: '800', color: C.text, marginTop: 8 },
  tagline: { fontSize: 14, fontWeight: '500', color: C.sub },
  error: { color: C.danger, fontSize: 13, fontWeight: '600', marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 999, paddingVertical: 18, marginTop: 16,
  },
  primaryBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/screens/PickDriverTypeScreen.tsx
git commit -m "feat(auth): add PickDriverTypeScreen for orphaned-profile recovery"
```

---

## Task 15: Auth navigation stack

**Files:**
- Create: `src/navigation/AuthStack.tsx`

- [ ] **Step 1: Create the stack**

```tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';

const Stack = createNativeStackNavigator();

export function AuthStack() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/navigation/AuthStack.tsx
git commit -m "feat(navigation): add AuthStack (Welcome → Login → Signup)"
```

---

## Task 16: App.tsx routing rewrite

**Files:**
- Modify: `App.tsx` (substantial rewrite)

- [ ] **Step 1: Replace `App.tsx` with the new routing logic**

```tsx
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WeekProvider } from './src/context/WeekContext';
import {
  OwnerOpTabs,
  CompanyMileTabs,
  CompanyCommissionTabs,
} from './src/navigation';
import { AuthStack } from './src/navigation/AuthStack';
import { PickDriverTypeScreen } from './src/screens/PickDriverTypeScreen';
import { supabase } from './src/supabase/client';
import { syncEngine } from './src/sync/syncEngine';
import { runMigrationAndPull } from './src/sync/migration';
import { saveDriverType } from './src/storage/storage';
import { C } from './src/theme';

type AuthState = 'loading' | 'signed-out' | 'needs-profile' | 'migrating' | 'ready' | 'error';

export default function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [driverType, setDriverType] = useState<string | null>(null);

  async function bootstrap(uid: string) {
    try {
      setUserId(uid);
      // 1. Fetch profile row
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('driver_type, name')
        .eq('user_id', uid)
        .maybeSingle();
      if (profErr) throw new Error(profErr.message);
      if (!profile) {
        setAuthState('needs-profile');
        return;
      }
      setAuthState('migrating');
      await saveDriverType(profile.driver_type);
      setDriverType(profile.driver_type);
      await runMigrationAndPull(uid);
      syncEngine.start();
      setAuthState('ready');
    } catch (e: any) {
      setError(e?.message ?? 'Sync failed');
      setAuthState('error');
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) bootstrap(data.session.user.id);
      else setAuthState('signed-out');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        syncEngine.stop();
        setUserId(null);
        setDriverType(null);
        setAuthState('signed-out');
      } else if (event === 'SIGNED_IN' && session?.user) {
        bootstrap(session.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  let content: React.ReactNode;
  if (authState === 'loading' || authState === 'migrating') {
    content = (
      <View style={s.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.loadingText}>
          {authState === 'migrating' ? 'Loading your data…' : ''}
        </Text>
      </View>
    );
  } else if (authState === 'error') {
    content = (
      <View style={s.center}>
        <Text style={s.errorTitle}>Couldn't load your data</Text>
        <Text style={s.errorBody}>{error}</Text>
        <TouchableOpacity
          style={s.retryBtn}
          onPress={() => {
            setError(null);
            supabase.auth.getSession().then(({ data }) => {
              if (data.session?.user) bootstrap(data.session.user.id);
              else setAuthState('signed-out');
            });
          }}
        >
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  } else if (authState === 'signed-out') {
    content = <AuthStack />;
  } else if (authState === 'needs-profile' && userId) {
    content = (
      <PickDriverTypeScreen
        userId={userId}
        onDone={() => bootstrap(userId)}
      />
    );
  } else if (authState === 'ready') {
    content = (
      <WeekProvider>
        {driverType === 'company-mile' ? (
          <CompanyMileTabs />
        ) : driverType === 'company-commission' ? (
          <CompanyCommissionTabs />
        ) : (
          <OwnerOpTabs />
        )}
      </WeekProvider>
    );
  } else {
    content = <View style={s.center} />;
  }

  return <SafeAreaProvider>{content}</SafeAreaProvider>;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: C.sub, fontWeight: '600' },
  errorTitle: { fontSize: 18, fontWeight: '800', color: C.danger, marginBottom: 8 },
  errorBody: { fontSize: 14, color: C.sub, textAlign: 'center', marginBottom: 16 },
  retryBtn: { backgroundColor: C.accent, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  retryText: { color: C.accentText, fontSize: 14, fontWeight: '700' },
});
```

Note: this imports `OwnerOpTabs`, `CompanyMileTabs`, `CompanyCommissionTabs` from `./src/navigation` (renamed exports — Task 17 updates the navigation module to export these directly).

- [ ] **Step 2: Type-check (will fail until Task 17 lands)**

Run: `npx tsc --noEmit`
Expected: errors about missing exports from `./src/navigation`. That's fine — Task 17 fixes them.

- [ ] **Step 3: Commit**

```bash
git add App.tsx
git commit -m "feat(auth): App.tsx routes by profile.driver_type, handles needs-profile state"
```

---

## Task 17: Navigation module rewrite (drop HomeScreen, export tab navigators)

**Files:**
- Modify: `src/navigation/index.tsx` (substantial rewrite)
- Delete: `src/screens/HomeScreen.tsx`
- Delete: `src/screens/AuthScreen.tsx`

- [ ] **Step 1: Read the current `src/navigation/index.tsx`** to see how tabs/stacks are structured today.

- [ ] **Step 2: Rewrite to export tab navigators directly**

Replace `src/navigation/index.tsx` with:

```tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { OwnerOpDashboard } from '../screens/owner-op/OwnerOpDashboard';
import { OwnerOpAddLoad } from '../screens/owner-op/OwnerOpAddLoad';
import { OwnerOpFuel } from '../screens/owner-op/OwnerOpFuel';
import { OwnerOpWeeklyExpenses } from '../screens/owner-op/OwnerOpWeeklyExpenses';
import { OwnerOpHistory } from '../screens/owner-op/OwnerOpHistory';

import { CompanyMileDashboard } from '../screens/company-mile/CompanyMileDashboard';
import { CompanyMileAddLoad } from '../screens/company-mile/CompanyMileAddLoad';
import { CompanyMileHistory } from '../screens/company-mile/CompanyMileHistory';

import { CompanyCommissionDashboard } from '../screens/company-commission/CompanyCommissionDashboard';
import { CompanyCommissionAddLoad } from '../screens/company-commission/CompanyCommissionAddLoad';
import { CompanyCommissionHistory } from '../screens/company-commission/CompanyCommissionHistory';

const OwnerOpTabsNav = createBottomTabNavigator();
const CompanyMileTabsNav = createBottomTabNavigator();
const CompanyCommissionTabsNav = createBottomTabNavigator();

export function OwnerOpTabs() {
  return (
    <NavigationContainer>
      <OwnerOpTabsNav.Navigator screenOptions={{ headerShown: false }}>
        <OwnerOpTabsNav.Screen name="Dashboard"   component={OwnerOpDashboard} />
        <OwnerOpTabsNav.Screen name="AddLoad"     component={OwnerOpAddLoad} />
        <OwnerOpTabsNav.Screen name="Fuel"        component={OwnerOpFuel} />
        <OwnerOpTabsNav.Screen name="Expenses"    component={OwnerOpWeeklyExpenses} />
        <OwnerOpTabsNav.Screen name="History"     component={OwnerOpHistory} />
      </OwnerOpTabsNav.Navigator>
    </NavigationContainer>
  );
}

export function CompanyMileTabs() {
  return (
    <NavigationContainer>
      <CompanyMileTabsNav.Navigator screenOptions={{ headerShown: false }}>
        <CompanyMileTabsNav.Screen name="Dashboard" component={CompanyMileDashboard} />
        <CompanyMileTabsNav.Screen name="AddLoad"   component={CompanyMileAddLoad} />
        <CompanyMileTabsNav.Screen name="History"   component={CompanyMileHistory} />
      </CompanyMileTabsNav.Navigator>
    </NavigationContainer>
  );
}

export function CompanyCommissionTabs() {
  return (
    <NavigationContainer>
      <CompanyCommissionTabsNav.Navigator screenOptions={{ headerShown: false }}>
        <CompanyCommissionTabsNav.Screen name="Dashboard" component={CompanyCommissionDashboard} />
        <CompanyCommissionTabsNav.Screen name="AddLoad"   component={CompanyCommissionAddLoad} />
        <CompanyCommissionTabsNav.Screen name="History"   component={CompanyCommissionHistory} />
      </CompanyCommissionTabsNav.Navigator>
    </NavigationContainer>
  );
}
```

Note: each navigator wraps itself in a `<NavigationContainer>` since they're now independent root navigators (no parent stack). The custom tab bar is added in Task 18.

For lease users, `OwnerOpTabs` works as-is (App.tsx routes both `'owner-op'` and `'lease'` here). The screens already read `driverType` from `route.params`, but here we don't pass it as an `initialParams` because the navigator has no parent passing it. **Add `initialParams={{ driverType: 'owner-op' }}` for the default**, OR refactor so the navigator accepts a `driverType` prop. Cleanest:

```tsx
export function OwnerOpTabs({ driverType = 'owner-op' }: { driverType?: string } = {}) {
  return (
    <NavigationContainer>
      <OwnerOpTabsNav.Navigator screenOptions={{ headerShown: false }}>
        <OwnerOpTabsNav.Screen name="Dashboard"  component={OwnerOpDashboard}  initialParams={{ driverType }} />
        <OwnerOpTabsNav.Screen name="AddLoad"    component={OwnerOpAddLoad}    initialParams={{ driverType }} />
        <OwnerOpTabsNav.Screen name="Fuel"       component={OwnerOpFuel}       initialParams={{ driverType }} />
        <OwnerOpTabsNav.Screen name="Expenses"   component={OwnerOpWeeklyExpenses} initialParams={{ driverType }} />
        <OwnerOpTabsNav.Screen name="History"    component={OwnerOpHistory}    initialParams={{ driverType }} />
      </OwnerOpTabsNav.Navigator>
    </NavigationContainer>
  );
}
```

Update App.tsx so it passes `<OwnerOpTabs driverType={driverType ?? 'owner-op'} />` when the resolved driver is 'lease' or 'owner-op'.

Also update CompanyMileTabs / CompanyCommissionTabs similarly to pass `initialParams={{ driverType: 'company-mile' }}` / `'company-commission'`.

- [ ] **Step 3: Update App.tsx to pass driverType**

In App.tsx Task 16, the ready branch becomes:

```tsx
content = (
  <WeekProvider>
    {driverType === 'company-mile' ? (
      <CompanyMileTabs />
    ) : driverType === 'company-commission' ? (
      <CompanyCommissionTabs />
    ) : (
      <OwnerOpTabs driverType={driverType ?? 'owner-op'} />
    )}
  </WeekProvider>
);
```

- [ ] **Step 4: Delete HomeScreen and old AuthScreen**

Run:
```bash
git rm src/screens/HomeScreen.tsx
git rm src/screens/AuthScreen.tsx
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (old errors from deleted screens are gone; new code should compile).

If any errors mention `OwnerOpTabs` not having `driverType` prop, ensure the typing is `({ driverType = 'owner-op' }: { driverType?: string } = {})` per the snippet above.

- [ ] **Step 6: Commit**

```bash
git add src/navigation/index.tsx App.tsx
git commit -m "feat(navigation): drop HomeScreen, expose tab navigators directly"
```

---

## Task 18: Custom floating TabBar component

**Files:**
- Create: `src/navigation/TabBar.tsx`
- Modify: `src/navigation/index.tsx` — pass `tabBar` prop

- [ ] **Step 1: Create the custom tab bar**

```tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Dashboard: 'home-outline',
  AddLoad:   'add-circle-outline',
  Fuel:      'water-outline',
  Expenses:  'wallet-outline',
  History:   'time-outline',
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.wrap, { paddingBottom: insets.bottom + 8 }]} pointerEvents="box-none">
      <View style={s.pill}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };
          const icon = ICONS[route.name] ?? 'ellipse-outline';
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={s.cell}
            >
              <View style={[s.iconWrap, isFocused && s.iconWrapActive]}>
                <Ionicons
                  name={icon}
                  size={isFocused ? 22 : 20}
                  color={isFocused ? C.accentText : C.sub}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    backgroundColor: C.cardElevated,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 56 },
  iconWrap: {
    width: 44, height: 44,
    borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: C.accent },
});
```

- [ ] **Step 2: Wire it into each navigator**

In `src/navigation/index.tsx`, import the TabBar:

```ts
import { TabBar } from './TabBar';
```

In each navigator, add `tabBar={(props) => <TabBar {...props} />}` to `<XxxTabsNav.Navigator>`:

```tsx
<OwnerOpTabsNav.Navigator
  screenOptions={{ headerShown: false }}
  tabBar={(props) => <TabBar {...props} />}
>
```

Do this for all three navigators.

- [ ] **Step 3: Add bottom-inset padding to screens to clear the tab bar**

The custom tab bar floats at the bottom and is ~80-90px tall. Screens with ScrollView contentContainerStyle should add `paddingBottom: 120` (or use `useSafeAreaInsets()` + 100). For now, add this in the per-screen restyle tasks (19+).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/navigation/TabBar.tsx src/navigation/index.tsx
git commit -m "feat(navigation): floating pill TabBar with yellow active circle"
```

---

## Task 19: Restyle OwnerOpDashboard

**Files:**
- Modify: `src/screens/owner-op/OwnerOpDashboard.tsx`

Pattern to apply across all screens (use this as the reference for tasks 19-25):

- Replace `<LinearGradient colors={[C.gradStart, C.gradEnd]}>` headers with `<ScreenHeader title={...} subtitle={...} right={<SignOutButton />} />` (Dashboards) or `<ScreenHeader title={...} left={<BackButton/>} />` (inner screens).
- Cards: `backgroundColor: C.card`, `borderRadius: 24`, no border.
- Primary buttons: `backgroundColor: C.accent`, text color `C.accentText`, `borderRadius: 999`, `paddingVertical: 16`.
- Inputs: wrap in a view with `backgroundColor: C.card`, `borderRadius: 16`, `paddingHorizontal: 16`. Input text color `C.text`, placeholder `C.muted`.
- Add `paddingBottom: 120` to ScrollView content to clear the floating tab bar.
- Drop SafeAreaView wrappers around the header (ScreenHeader handles its own insets).

- [ ] **Step 1: Read `src/screens/owner-op/OwnerOpDashboard.tsx`**

- [ ] **Step 2: Replace header section**

Find the `<View style={s.root}>` → `<LinearGradient>` block. Replace the entire LinearGradient (including SafeAreaView + content) with:

```tsx
<ScreenHeader
  title={title}
  subtitle={driverName ? driverName : 'Tap to add name'}
  right={<SignOutButton />}
/>
```

Add imports:
```ts
import { ScreenHeader } from '../../components/ScreenHeader';
import { SignOutButton } from '../../components/SignOutButton';
```

Remove the now-unused imports: `LinearGradient`, `SafeAreaView`.

- [ ] **Step 3: Update the body styling**

In the StyleSheet, change:
- `s.root.backgroundColor` → `C.bg` (likely already)
- `s.body.paddingBottom` → `120` (was `40`)
- `s.statCard.backgroundColor` → `C.card`
- `s.statCard` add `borderRadius: 20`
- `s.statValue.color` → `C.text`
- `s.statLabel.color` → `C.sub`
- `s.netBox` block: rebuild as a card with `backgroundColor: C.card`, `borderRadius: 24`, `padding: 24`, centered text
- `s.loadCard.backgroundColor` → `C.card`
- `s.loadCard.borderRadius` → `20`
- `s.editBtn.backgroundColor` → `C.card`; `s.deleteBtn.backgroundColor` → `C.card`
- `s.editBtnText.color` → `C.accent`; `s.deleteBtnText.color` → `C.danger`

- [ ] **Step 4: Build a small NetProfit card**

Replace the existing inline net-profit block with:

```tsx
<View style={s.netCard}>
  <Text style={s.netLabel}>NET PROFIT</Text>
  <Text style={[s.netValue, { color: summary.netProfit >= 0 ? C.success : C.danger }]}>
    {fmt(summary.netProfit)}
  </Text>
</View>
```

Styles:
```ts
netCard: { backgroundColor: C.card, borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 16 },
netLabel: { fontSize: 11, fontWeight: '700', color: C.sub, letterSpacing: 1.5 },
netValue: { fontSize: 40, fontWeight: '900', marginTop: 8 },
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/owner-op/OwnerOpDashboard.tsx
git commit -m "feat(ui): restyle OwnerOpDashboard with dark theme + ScreenHeader"
```

---

## Task 20: Restyle OwnerOpAddLoad, OwnerOpFuel, OwnerOpWeeklyExpenses

**Files:**
- Modify: `src/screens/owner-op/OwnerOpAddLoad.tsx`
- Modify: `src/screens/owner-op/OwnerOpFuel.tsx`
- Modify: `src/screens/owner-op/OwnerOpWeeklyExpenses.tsx`

Apply the same restyle pattern (see Task 19 for the reference).

For each file:

- [ ] **Step 1: Replace the gradient header**

Find `<LinearGradient colors={[C.gradStart, C.gradEnd]}>...</LinearGradient>` (with its SafeAreaView/content). Replace with:

```tsx
<ScreenHeader
  title="Add Load"  // or "Fuel" / "Weekly Expenses"
  subtitle={formatWeekDisplay(weekKey)}  // if applicable
/>
```

Add `import { ScreenHeader } from '../../components/ScreenHeader';`. Remove unused `LinearGradient`, `SafeAreaView` imports.

- [ ] **Step 2: Restyle inputs**

Find each input row (typically `<View style={s.inputRow}>...`). Update its style:

```ts
inputRow: {
  flexDirection: 'row', alignItems: 'center', gap: 10,
  backgroundColor: C.card, borderRadius: 16,
  paddingHorizontal: 16, marginBottom: 12,
},
input: { flex: 1, fontSize: 16, paddingVertical: 16, color: C.text },
prefix: { fontSize: 16, color: C.sub },
```

The single-line `<TextInput style={s.input}>` (without the row wrapper, used for odometer e.g.) should be wrapped in the same row pattern OR keep its style and update colors to `backgroundColor: C.card, borderRadius: 16, padding: 16, color: C.text`.

- [ ] **Step 3: Restyle the save button**

Find the `<TouchableOpacity onPress={handleSave}>` block. Replace its inner `<LinearGradient>` with:

```tsx
<View style={s.saveBtn}>
  <Text style={s.saveBtnText}>Save</Text>
</View>
```

Styles:
```ts
saveBtn: {
  backgroundColor: C.accent, borderRadius: 999,
  paddingVertical: 18, alignItems: 'center', marginTop: 16,
},
saveBtnText: { color: C.accentText, fontSize: 16, fontWeight: '800' },
```

Remove the `LinearGradient` import if no longer used.

- [ ] **Step 4: Add bottom padding for the floating tab bar**

In the ScrollView, change `contentContainerStyle={s.form}` so `s.form.paddingBottom: 140` (large enough to clear the tab bar above the keyboard).

- [ ] **Step 5: Update section title / label colors**

`s.sectionTitle.color` → `C.sub` (already), `s.fieldLabel.color` → `C.sub` (already). No change likely needed since theme tokens auto-update.

- [ ] **Step 6: Restyle calc/info boxes (if present)**

E.g. in `OwnerOpWeeklyExpenses` the `s.calcBox` with `backgroundColor: '#EFF6FF'` — change to `backgroundColor: C.card`, `calcText.color` → `C.accent`.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/screens/owner-op/OwnerOpAddLoad.tsx src/screens/owner-op/OwnerOpFuel.tsx src/screens/owner-op/OwnerOpWeeklyExpenses.tsx
git commit -m "feat(ui): restyle OwnerOp forms (AddLoad, Fuel, Expenses) with dark theme"
```

---

## Task 21: Restyle OwnerOpHistory

**Files:**
- Modify: `src/screens/owner-op/OwnerOpHistory.tsx`

- [ ] **Step 1: Replace gradient header**

Same pattern as Task 19:

```tsx
<ScreenHeader title="History" subtitle="Owner Operator — all weeks" />
```

(Or `subtitle={driverType === 'lease' ? 'Lease Driver — all weeks' : 'Owner Operator — all weeks'}` to preserve existing behavior.)

- [ ] **Step 2: Restyle week cards**

`s.weekCard.backgroundColor` → `C.card`, `s.weekCard.borderRadius` → `24`, remove existing shadow shadowColor blue, use the dark `shadow` import.

`s.weekIconBox.backgroundColor` → `C.cardElevated`.
`s.weekLabel.color` → `C.text`.
`s.weekSub.color` → `C.sub`.

`s.deleteWeekBtn.backgroundColor` → `C.card`, icon color `C.danger`.

`s.summaryStrip` colors: `backgroundColor: C.cardElevated`. `summaryLabel.color` → `C.sub`. `summaryValue.color` → `C.text`. `summaryDivider.backgroundColor` → `C.border`.

`s.netRow`: `netLabel.color` → `C.sub`, `netValue` color stays dynamic (green/red).

`s.loadCard.backgroundColor` → `C.cardElevated`, `s.loadRoute.color` → `C.text`, `s.loadDetail.color` → `C.sub`, `s.bold.color` → `C.text`.

`s.editBtn.backgroundColor` → `C.card`; `editBtnText.color` → `C.accent`. `s.deleteBtn.backgroundColor` → `C.card`; `deleteBtnText.color` → `C.danger`.

- [ ] **Step 3: Add bottom padding**

`s.body.paddingBottom` → `140`.

- [ ] **Step 4: Remove unused imports** (`LinearGradient`, `SafeAreaView`)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/screens/owner-op/OwnerOpHistory.tsx
git commit -m "feat(ui): restyle OwnerOpHistory with dark theme"
```

---

## Task 22: Restyle CompanyMile screens

**Files:**
- Modify: `src/screens/company-mile/CompanyMileDashboard.tsx`
- Modify: `src/screens/company-mile/CompanyMileAddLoad.tsx`
- Modify: `src/screens/company-mile/CompanyMileHistory.tsx`

Apply the same restyle pattern from Tasks 19-21:
- Replace LinearGradient headers with `<ScreenHeader>` (Dashboard gets `right={<SignOutButton />}`)
- Cards use `C.card` + `borderRadius: 24`
- Buttons use `C.accent` pill style
- Inputs use the dark wrap pattern
- Add `paddingBottom: 140` to scroll containers
- Update all colors to use the new theme tokens

- [ ] **Step 1: Restyle CompanyMileDashboard**

Same approach as Task 19 (Dashboard pattern). Key differences: 2 stat cards (Earnings + Miles) instead of 6.

- [ ] **Step 2: Restyle CompanyMileAddLoad**

Same approach as Task 20 (Form pattern). Two number inputs (paidMileage + centsPerMile).

- [ ] **Step 3: Restyle CompanyMileHistory**

Same approach as Task 21.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/company-mile/
git commit -m "feat(ui): restyle CompanyMile screens with dark theme"
```

---

## Task 23: Restyle CompanyCommission screens

**Files:**
- Modify: `src/screens/company-commission/CompanyCommissionDashboard.tsx`
- Modify: `src/screens/company-commission/CompanyCommissionAddLoad.tsx`
- Modify: `src/screens/company-commission/CompanyCommissionHistory.tsx`

Same as Task 22 but for the commission screens.

- [ ] **Step 1-3:** Apply restyle to each file (Dashboard, AddLoad, History).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/screens/company-commission/
git commit -m "feat(ui): restyle CompanyCommission screens with dark theme"
```

---

## Task 24: Restyle shared components

**Files:**
- Modify: `src/components/CurrencyInput.tsx`
- Modify: `src/components/CommissionSelector.tsx`
- Modify: `src/components/SummaryCard.tsx`
- Modify: `src/components/SyncStatusBadge.tsx`

- [ ] **Step 1: CurrencyInput** — wrap matches the form inputs:
  - Container: `backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center'`
  - `$` prefix color: `C.sub`
  - Input color: `C.text`, placeholder `C.muted`

- [ ] **Step 2: CommissionSelector** — pill buttons:
  - Unselected: `backgroundColor: C.card`, text color `C.text`
  - Selected: `backgroundColor: C.accent`, text color `C.accentText`
  - `borderRadius: 999`

- [ ] **Step 3: SummaryCard** — rows:
  - Container `backgroundColor: C.card, borderRadius: 20, padding: 20`
  - Label `C.sub`, value `C.text`

- [ ] **Step 4: SyncStatusBadge** — already implemented in dark style; verify colors:
  - Pill `backgroundColor: 'rgba(255,214,0,0.18)'` (yellow tint) when syncing
  - Pill `backgroundColor: C.danger` when error
  - Text color `C.accent` when syncing, `#fff` when error

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/
git commit -m "feat(ui): restyle shared components (CurrencyInput, CommissionSelector, SummaryCard, SyncStatusBadge)"
```

---

## Task 25: Configure Supabase autoconfirm (manual)

**Files:** none (Supabase Management API call)

- [ ] **Step 1: Ask the user**

> One Supabase setting needs to be changed: **Authentication → Providers → Email → "Confirm email" must be OFF** (so signups auto-confirm and users are immediately signed in, no email verification step).
>
> Reply "done" once you've toggled it. Or paste a fresh access token (`sbp_...`) and I'll do it via the management API.

If they share a token, run:

```bash
curl -s -X PATCH "https://api.supabase.com/v1/projects/wuegzljzxnacssxzxfsh/config/auth" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mailer_autoconfirm":true}'
```

- [ ] **Step 2: Verify**

If the user shares a token, after the PATCH, GET the auth config and confirm `mailer_autoconfirm: true`.

- [ ] **Step 3: No commit** (config only).

---

## Task 26: Run full test suite + type-check

**Files:** none

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all new tests pass. The 3 pre-existing `calculations.test.ts` failures are documented and acceptable. No new failures should be introduced.

- [ ] **Step 2: Run type-check**

Run: `npx tsc --noEmit`
Expected: no new errors compared to baseline.

- [ ] **Step 3: If anything new is broken, fix it**

Debug and fix. Most likely sources of regressions:
- Storage test calling `saveProfileName(driverType, name)` with old signature → update to `saveProfileName(name)`
- Syncing test asserting `upsert` for profile → switch to `update`
- Import of deleted `HomeScreen` or `AuthScreen` anywhere → remove or replace

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git status   # verify only intended files
git commit -m "fix: stabilize tests after auth + theme rewrite"
```

(Skip if nothing needed fixing.)

---

## Task 27: Manual QA on device

**Files:** none

Manual — pause and ask the user to test.

- [ ] **Step 1: Start the dev server**

```bash
npx expo start --port 8083
```

- [ ] **Step 2: Walk through the QA script**

Ask the user to test these flows on their phone (or kill any old Expo Go session first to force a fresh bundle):

1. **Fresh launch (signed out):** lands on WelcomeScreen with the truck photo + Log in / Sign up buttons.
2. **Sign up flow:** Tap Sign up → enter new email + password + confirm + pick a driver type → tap Create Account → land directly in the chosen tabs (no HomeScreen).
3. **Add a load:** From Dashboard → tap AddLoad tab → fill in → Save. Load appears on Dashboard.
4. **Bottom tab bar:** Floating pill at the bottom, yellow circle behind the active tab. Tapping switches.
5. **Sign out:** Top-right "Sign out" button in Dashboard header. Confirm → back to WelcomeScreen.
6. **Sign in flow:** Tap Log in → enter same email + password → land in tabs, loads come back.
7. **Bad password attempt:** Wrong password → "Wrong email or password" inline error.
8. **Email re-signup:** Try signing up with the same email again → "An account with this email already exists" error.
9. **Visual check:** Dark theme everywhere, yellow accents on primary buttons + active tab. No remnants of the old light/blue theme.

- [ ] **Step 3: Report**

Document any issues. If everything works, mark the plan complete.

---

## Out of Scope (deferred)

- Forgot password flow
- Email verification on signup (autoconfirm is on)
- Driver-type change UI (one-time pick)
- Real onboarding carousel on WelcomeScreen (3 static dots only)
- Social login (Google / Apple)
- Lease driver in DriverTypeGrid is wired but unused if the user already picked owner-op — both share the same UI/tabs
