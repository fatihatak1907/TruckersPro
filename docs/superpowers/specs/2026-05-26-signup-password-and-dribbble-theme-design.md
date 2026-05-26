# Signup + Password Auth + Driver-Type Lock + Dark-Theme Redesign — Design

**Date:** 2026-05-26
**Status:** Approved (pending review)

## Goal

Replace OTP authentication with email+password (with a signup flow), lock each account to a single driver type chosen at signup, drop the HomeScreen driver-type picker in favor of routing the user directly into their chosen tabs, and re-skin the entire app in a Dribbble-inspired dark theme with yellow accents.

## Non-Goals

- "Forgot password" flow (deferred — needs a deep link or reset email setup)
- Email verification on signup (autoconfirm enabled; can be toggled on later)
- Changing driver type after signup (would require manual support intervention)
- Multi-account-per-device support

## Visual System

Inspired by the Hume mobile app design (Dribbble reference shared during brainstorm).

**Palette:**
- `bg`: `#0F1419` — deep charcoal background
- `card`: `#1A1F26` — slightly lighter dark for cards / inputs
- `cardElevated`: `#222831` — for layered cards
- `accent`: `#FFD600` — bright yellow, the **only** non-grayscale color in the UI; used sparingly for primary buttons, active tab, status pills
- `accentText`: `#0F1419` — black text on yellow backgrounds
- `text`: `#FFFFFF`
- `sub`: `#9CA3AF` — secondary text / labels
- `muted`: `#6B7280` — placeholder text
- `border`: `#2A3038` — subtle dividers
- `danger`: `#EF4444` — red for errors only
- `success`: `#34D399` — green for positive numbers (net profit, etc.)

**Typography:**
- System sans (default) with heavy weights — `weight: '800'` for titles, `'700'` for buttons, `'500'-'600'` for body
- Title sizes: 28-32pt, weight 800
- Section labels: 11-12pt, weight 700, letter-spacing 1.5, color `sub`, often uppercase
- Body / values: 14-16pt, weight 600, color `text`

**Components:**
- All cards: `borderRadius: 24`, no border, `backgroundColor: card`, internal padding 20
- Primary buttons: `borderRadius: 999` (pill), `backgroundColor: accent`, text `accentText` bold
- Secondary buttons: `borderRadius: 999`, `backgroundColor: card`, text `text`
- Inputs: `borderRadius: 16`, `backgroundColor: card`, no visible border in default state, `borderColor: accent` when focused
- Icon containers: 40×40 circle, `backgroundColor: card`
- Status pills: small (h: 28), `borderRadius: 999`, yellow background, black bold text

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  App.tsx (auth + profile gate)                       │
│  ─ no session  → <AuthStack>                         │
│                   ├ WelcomeScreen                    │
│                   ├ LoginScreen                      │
│                   └ SignupScreen                     │
│  ─ session, no profile → <PickDriverTypeScreen>      │
│  ─ session + profile   → bootstrap → driver tabs     │
└──────────────────────────────────────────────────────┘
                            │
                            ▼
              <WeekProvider><DriverTypeRouter/></WeekProvider>
                            │
                            ▼
                   matches profile.driver_type
                            │
        ┌───────────────────┼───────────────────────┐
        ▼                   ▼                       ▼
  OwnerOpTabs          CompanyMileTabs       CompanyCommissionTabs
  (also Lease)
```

**HomeScreen is deleted.**

## Schema Changes

Restructure `profiles` to be **one row per user** with the locked driver type:

```sql
-- Wipe existing test data (per Decision: existing user goes through fresh signup)
delete from loads;
delete from fuel_entries;
delete from weekly_expenses;
drop table profiles;
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

**App-side:**
- `src/storage/storage.ts`: `saveProfileName(name)` / `getProfileName()` lose the `driverType` arg (no longer needed — only one profile per user). Storage key becomes `profile:name` (no driver-type segment).
- `src/sync/types.ts`: `upsertProfile` op payload becomes `{ name: string }`. The initial driver-type write happens directly during signup (not via the queue), so no new op is needed.
- `src/sync/syncEngine.ts`: update `upsertProfile` dispatcher to no longer include `driver_type`.
- `src/storage/storage.ts` `pullFromSupabase`: read both `name` AND `driver_type` from the single profile row, write `profile:name` and `profile:driver_type` into AsyncStorage.
- New helper `getCurrentDriverType()` reads `profile:driver_type` from AsyncStorage (synchronous-ish; used by App.tsx during bootstrap).

**`weekly_expenses` / `loads` / `fuel_entries` tables:** unchanged. Their `driver_type` column becomes effectively redundant (every row a user creates will have the same `driver_type` as their profile), but removing it is more churn than benefit. The app guarantees consistency at write time.

## Auth Flow

**Three screens stacked in an `AuthStack` (`@react-navigation/native-stack`):**

### `WelcomeScreen` (entry point when signed out)

```
┌────────────────────────────────────┐
│ [ full-bleed truck photo, dark    ]│
│ [ overlay gradient bottom→top      ]│
│ [                                  ]│
│ [   Drive smart.                   ]│  ← title, 36pt, weight 800, white
│ [   Track every mile.              ]│
│ [                                  ]│
│ [   ●  ○  ○                        ]│  ← pagination dots (placeholder)
│ [                                  ]│
│ [  ╭──────────╮  ╭──────────╮     ]│  ← two pill buttons, side-by-side
│ [  │  Log in  │  │ Sign up  │     ]│     frosted dark glass effect
│ [  ╰──────────╯  ╰──────────╯     ]│     (rgba(255,255,255,0.18) bg)
└────────────────────────────────────┘
```

- Background image: `assets/welcome-bg.jpg` (**user provides** — drop into `assets/`, any landscape truck/road photo)
- Bottom buttons: `Log in` → `LoginScreen`, `Sign up` → `SignupScreen`
- Pagination dots are visual only (not a real carousel for v1; YAGNI)

### `LoginScreen`

```
[ logo 100×100, centered ]
[ TruckersPro            ]   ← 32pt, weight 800, white
[ Welcome back           ]   ← 16pt, weight 500, sub color

  Email
  [📧 you@example.com         ]

  Password
  [🔒 ••••••••              👁]

  ╭──────────────────────────────╮
  │       Sign In            →   │   ← yellow pill button
  ╰──────────────────────────────╯

  ────  Don't have an account? Sign up  ────
```

Behavior:
- Validates email format + non-empty password client-side
- Calls `supabase.auth.signInWithPassword({ email, password })`
- On success → App.tsx auth listener fires → bootstrap → tabs
- On error → inline error message under the form (e.g., "Wrong email or password")
- Show/hide password toggle on the right of the password input

### `SignupScreen`

```
[ logo 100×100, centered ]
[ Create account         ]
[ Pick your driver type below ]

  Email
  [📧 you@example.com         ]

  Password
  [🔒 ••••••••              👁]

  Confirm password
  [🔒 ••••••••              👁]

  I AM A...
  ┌────────────────┐ ┌────────────────┐
  │ 🚛 Owner Op    │ │ 🔑 Lease       │
  └────────────────┘ └────────────────┘
  ┌────────────────┐ ┌────────────────┐
  │ 💵 Company $/mi│ │ 💼 Company %   │
  └────────────────┘ └────────────────┘

  ╭──────────────────────────────╮
  │      Create Account      →   │
  ╰──────────────────────────────╯

  Already have an account? Sign in
```

Driver-type cards:
- 2×2 grid, each card `flex: 1`, square aspect
- Unselected: `bg: card`, white text, white icon
- Selected: `bg: accent`, black text, black icon, subtle shadow
- Tapping toggles selection; only one can be selected

Behavior:
- Validates: email format, password ≥ 8 chars, password === confirm, driver type chosen
- Calls `supabase.auth.signUp({ email, password })`
- On success (autoconfirm = true): user is immediately signed in
- Insert profile row: `await supabase.from('profiles').upsert({ user_id, driver_type, name: '' })`
  - We `await` this directly (not via sync queue) because App.tsx needs the profile row to exist before bootstrap routes the user
- App.tsx auth listener fires → bootstrap → tabs
- Errors:
  - "Email already taken" → "An account with this email already exists. Try signing in."
  - Weak password → inline before Supabase call

### `PickDriverTypeScreen` (edge case only)

Shown if a user is signed in but their `profiles` row is missing (e.g., signup was interrupted between `auth.signUp` and the profile insert). Same driver-type grid as SignupScreen, single "Continue" button. Writes the profile row and proceeds.

## Routing (App.tsx Rewrite)

```ts
type AuthState =
  | 'loading'
  | 'signed-out'       // → AuthStack
  | 'needs-profile'    // → PickDriverTypeScreen
  | 'migrating'        // → "Loading…" overlay
  | 'ready'            // → tabs for resolved driverType
  | 'error';

// Bootstrap after SIGNED_IN:
// 1. fetch profiles row
// 2. if missing → 'needs-profile'
// 3. else run runMigrationAndPull(userId), syncEngine.start()
// 4. set driverType + 'ready'
```

Render:

```tsx
if (authState === 'signed-out') return <AuthStack />;
if (authState === 'needs-profile') return <PickDriverTypeScreen userId={...} />;
if (authState === 'ready') return (
  <WeekProvider>
    {driverType === 'company-mile' ? <CompanyMileTabs /> :
     driverType === 'company-commission' ? <CompanyCommissionTabs /> :
     <OwnerOpTabs />}  {/* 'owner-op' or 'lease' use same tab navigator */}
  </WeekProvider>
);
```

**Navigation changes:**
- `src/navigation/index.tsx` no longer has a root Stack with HomeScreen
- Each tab navigator (`OwnerOpTabs`, `LeaseTabs`, `CompanyMileTabs`, `CompanyCommissionTabs`) becomes a top-level export
- App.tsx mounts the matching one directly
- `OwnerOpTabs` accepts a `driverType` prop (defaulting to `'owner-op'`) so `'lease'` can reuse the same navigator

## UI Component Restyle

### `src/theme.ts` — full rewrite

New palette (above). Shadow helpers updated for dark theme.

### New shared component `src/components/ScreenHeader.tsx`

Used by every Dashboard / Add Load / Fuel / Expenses / History screen.

```tsx
<ScreenHeader
  title="Owner Operator"
  subtitle={driverName || 'Tap to add name'}
  right={<SignOutButton />}     // Dashboard
  // OR
  left={<BackButton />}          // inner screens
/>
```

Renders:
```
┌──────────────────────────────────────────────────────┐
│ [logo 28]  Title  [right slot]                       │
│            subtitle                                  │
└──────────────────────────────────────────────────────┘
```

- Uses `useSafeAreaInsets()` for top padding (works on Android)
- Background: solid `bg` color (NOT a gradient — Dribbble style is flat dark)
- 16pt logo + title spacing

### `src/components/SignOutButton.tsx` (new)

Small yellow pill in the header right slot. `handleSignOut` logic moved out of HomeScreen into `src/utils/signOut.ts` for reuse.

### `src/navigation/TabBar.tsx` (new — custom tab bar)

Replaces the default React Navigation tab bar with a Dribbble-style floating pill:

- Floats at the bottom, ~24px from screen edges, full-width minus padding
- Dark `cardElevated` background, `borderRadius: 999`
- 5 icons evenly spaced
- Active tab: yellow circle 44×44 behind the icon (icon turns black)
- Inactive: just the icon, gray color
- 56px tall total

Wired via React Navigation's `tabBar` prop on each tab navigator.

### Per-screen restyle

Every existing screen needs visual updates to match the dark theme:

- **Dashboard** (`OwnerOpDashboard`, `CompanyMileDashboard`, `CompanyCommissionDashboard`):
  - Replace gradient header with `<ScreenHeader>`
  - Net profit displayed in a large rounded card, value in white/yellow/green
  - Stats grid: fixed width per card to prevent wrap on narrow screens
  - "Loads This Week" section as dark cards
  - Sign-out button in header right slot (replaces home button)

- **AddLoad** (`OwnerOpAddLoad`, `CompanyMileAddLoad`, `CompanyCommissionAddLoad`):
  - Inputs use new dark style
  - Save button is full-width yellow pill at bottom (with bottom safe-area inset)
  - Keyboard-aware: button visible above keyboard

- **Fuel** (`OwnerOpFuel`):
  - Entry cards in dark theme
  - Add Fuel form same styling as AddLoad

- **WeeklyExpenses** (`OwnerOpWeeklyExpenses`):
  - All input groups restyled
  - Save button bottom-anchored pill

- **History** (`OwnerOpHistory`, `CompanyMileHistory`, `CompanyCommissionHistory`):
  - Week cards as dark cards with rounded corners
  - Expanded week content: same dark cards, lighter background

- **SyncStatusBadge** (existing):
  - Update to use yellow theme for the syncing state, red for errors

### Safe-area pass

- Add `<SafeAreaProvider>` wrapping the app in `App.tsx` (root, before everything else)
- `react-native-safe-area-context` already a transitive dependency of `@react-navigation`
- Every screen uses `useSafeAreaInsets()` for top + bottom padding instead of `<SafeAreaView>`

## Asset Required

- `assets/welcome-bg.jpg` — user-supplied truck/road photo for the WelcomeScreen background. Spec assumes this filename. If user picks a different name, update the require path in `WelcomeScreen.tsx`.

## Supabase Config Changes

One-time via Management API or dashboard:
- `mailer_autoconfirm: true` — bypass email verification on signup
- (Optional, cleanup) Revert the OTP-customized email templates to defaults — they're unused now

## Testing

- `__tests__/storage.test.ts` — update `saveProfileName` / `getProfileName` tests to drop the `driverType` arg
- `__tests__/syncEngine.test.ts` — update `upsertProfile` test for new payload shape (no driver_type)
- `__tests__/migration.test.ts` — verify the new single-row profile pull works
- Auth screens — manual QA only (real Supabase calls)
- Theme: visual QA only

## Edge Cases

- **Profile row missing after signed-in:** route to `PickDriverTypeScreen`. Could happen if signup completes `auth.signUp` but the profile insert fails (network drop). User picks driver type, profile row written, normal bootstrap continues.
- **Sign out → wipe → sign in as different user:** existing `wipeAll()` handles this. New user goes through normal bootstrap.
- **Bad password on signup (Supabase rejects):** inline error, no profile row created, user stays on SignupScreen.
- **Driver-type change request:** not supported. User must contact support (out-of-scope manual fix in Supabase).

## Out of Scope (future work)

- Forgot password / reset email
- Email verification on signup
- Driver-type change UI
- Real onboarding carousel on WelcomeScreen (pagination dots are static for v1)
- Social login (Google / Apple)
- Dark/light theme toggle (dark only)

## File Layout

```
assets/
  welcome-bg.jpg          # user-supplied

src/
  navigation/
    index.tsx             # rewritten: exports tab navigators only
    TabBar.tsx            # new: floating pill tab bar
  screens/
    WelcomeScreen.tsx     # new
    LoginScreen.tsx       # new (replaces AuthScreen)
    SignupScreen.tsx      # new
    PickDriverTypeScreen.tsx  # new (edge case)
    HomeScreen.tsx        # DELETED
    AuthScreen.tsx        # DELETED
    owner-op/             # restyled
    company-mile/         # restyled
    company-commission/   # restyled
  components/
    ScreenHeader.tsx      # new
    SignOutButton.tsx     # new
    DriverTypeGrid.tsx    # new (used in Signup + PickDriverType)
    CurrencyInput.tsx     # restyled to dark
    CommissionSelector.tsx # restyled
    SummaryCard.tsx       # restyled
    SyncStatusBadge.tsx   # restyled
  utils/
    signOut.ts            # new (extracted from HomeScreen)
  theme.ts                # full rewrite
  storage/storage.ts      # profile API simplified
  sync/types.ts           # upsertProfile payload simplified
  sync/syncEngine.ts      # upsertProfile dispatcher updated
App.tsx                   # routing rewrite (no HomeScreen, auth gate, profile fetch)
```
