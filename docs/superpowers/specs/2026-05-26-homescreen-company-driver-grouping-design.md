# HomeScreen Company Driver Grouping

## Goal
Consolidate "Company Driver — Per Mile" and "Company Driver — Commission" under a single expandable "Company Driver" card in an "Other" section on the HomeScreen.

## Layout

**Section: SELECT DRIVER TYPE**
- Owner Operator card (unchanged — navigates to OwnerOp)

**Section: OTHER**
- Company Driver card
  - Tapping toggles an expanded state
  - When expanded, two indented sub-rows appear below:
    - Per Mile → navigates to CompanyMile
    - Commission → navigates to CompanyCommission
  - Chevron icon rotates 90° when expanded

## Behavior
- Only the HomeScreen (`src/screens/HomeScreen.tsx`) changes
- Navigation targets (CompanyMile, CompanyCommission) are unchanged
- Tapping "Company Driver" itself never navigates — only sub-rows do
- Expanded state is local `useState` — no persistence needed
- Tapping the card again collapses it

## Files Changed
- `src/screens/HomeScreen.tsx` — restructure `DRIVER_TYPES` list, add `OTHER` section with expandable Company Driver card
