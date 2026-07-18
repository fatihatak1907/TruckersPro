# Name Edit Modal + Extra Mileage — Design Spec

**Date:** 2026-07-18

## 1. Cross-platform name editing (all four dashboards)

- New module-scope component `src/components/NameEditModal.tsx`:
  `NameEditModal({ visible, initialName, onSave, onClose })` — transparent RN `Modal` (fade), centered dark card (`C.card`), title "Driver / Company Name", TextInput prefilled with `initialName` (autoFocus), Cancel + Save buttons. Save calls `onSave(text.trim())` then closes. Works on Android and iOS (replaces the iOS-only `Alert.prompt`).
- All four dashboards (`OwnerOpDashboard`, `CompanyMileDashboard`, `CompanyCommissionDashboard`) swap `handleEditName`'s `Alert.prompt` for modal state: header `onPress` opens the modal; `onSave` runs `saveProfileName(name)` + `setDriverName(name)`. (OwnerOpDashboard serves both owner-op and lease.)
- Header layouts unchanged: owner-op/lease keep mode title + name subtitle; company modes keep name-as-title with fallback.
- Empty save allowed → clears the name (headers fall back per existing logic).

## 2. Extra mileage (company per-mile)

- `LoadEntry` gains `extraMileage?: number`.
- Earnings math: `(paidMileage + extraMileage) × centsPerMile` everywhere — `calcCompanyMileSummary`, AddLoad preview, dashboard/history load rows.
- `CompanyMileAddLoad`: new ✓-confirm field **EXTRA MILEAGE** (`money={false}`, placeholder "e.g. 50") directly under PAID MILEAGE. Optional: 0/empty is valid; validation still requires only paid mileage > 0 and rate > 0. Saved on the load as `extraMileage` (0 when unset).
- Display rows (dashboard + history): `"{paid} mi + {extra} extra × ${rate}/mi = $X"` when extra > 0; unchanged text when extra is 0/absent.
- Sync: `upsertLoad` payload adds `extra_mileage: l.extraMileage ?? null`; pull maps `extraMileage: row.extra_mileage ?? undefined`.
- **schema-v5.sql**: `alter table loads add column if not exists extra_mileage numeric;` (nullable, additive). Applied to the live DB via Management API BEFORE merge/build (upsertLoad sends the column on every load save for all driver types — missing column would jam the sync queue).
- Company commission and owner-op modes: no UI change; their loads simply sync `extra_mileage: null`.

## Testing

- calculations.test.ts: `calcCompanyMileSummary` with extra mileage (e.g. 500 paid + 50 extra × $0.55 = $302.50) and without (unchanged).
- syncEngine.test.ts: upsertLoad payload carries `extra_mileage` (null when absent, value when set).
- Suite green, tsc clean; manual on preview APK (name edit on Android is now testable).
