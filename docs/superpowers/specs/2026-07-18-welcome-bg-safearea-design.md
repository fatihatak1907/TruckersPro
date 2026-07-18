# Welcome Background + Bottom Safe-Area — Design Spec

**Date:** 2026-07-18

1. **Welcome background:** `Login background.png` (project root, user-supplied) copied to `assets/login-bg.png`; `WelcomeScreen` ImageBackground uses it instead of `assets/welcome-bg.jpg`. Existing gradient overlay unchanged.
2. **Remove pagination lines:** delete the `dots` row (3 horizontal bars) under the headline in `WelcomeScreen`, plus its styles.
3. **Bottom safe-area for sheets (app-wide fix):** `InsightsSheet` and `StatePicker` modal sheets add `useSafeAreaInsets().bottom` to their bottom padding so bottom-anchored buttons/rows clear the Android navigation/gesture bar. These are the only two surfaces missing the inset (TabBar and WelcomeScreen already apply it).

Testing: `tsc` clean, suite green (no logic change); manual on preview APK.
