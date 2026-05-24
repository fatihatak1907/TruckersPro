# TruckersPro — Expense Tracker App Design

**Date:** 2026-05-24
**Platform:** iOS (Expo + React Native)
**Storage:** Local (AsyncStorage) — cloud backend to be added later

---

## Overview

TruckersPro is a mobile expense tracking app for truckers. It supports two primary driver types — Owner Operators and Company Drivers — each with their own data entry flows and weekly summary dashboards. Loads are entered one at a time as they happen, and the app automatically groups them into weekly summaries (week starts on Monday).

---

## Architecture

- **Framework:** Expo (React Native) with Expo Go for demo on device
- **Navigation:** React Navigation — stack + tab navigator
- **Storage:** AsyncStorage, keyed by `driverType + weekStartDate`
- **State:** React Context or Zustand for in-session state
- **Calculations:** All totals computed client-side from stored entries

---

## Navigation Structure

```
Home Screen
├── Owner Operator
│   ├── Weekly Dashboard
│   ├── Add Load
│   ├── Weekly Expenses
│   └── Week History
├── Company Driver — Per Mile
│   ├── Weekly Dashboard
│   ├── Add Load
│   └── Week History
└── Company Driver — Commission
    ├── Weekly Dashboard
    ├── Add Load
    └── Week History
```

---

## Screens & Fields

### Owner Operator

#### Add Load (per-load entry)
| Field | Type | Notes |
|-------|------|-------|
| Starting State | Text input | State name or abbreviation |
| End State / Address | Text input | State name or full address |
| Earnings | Number input | Gross load pay |
| Diesel cost | Number input | Fuel cost for this load |
| DEF cost | Number input | DEF cost for this load |
| Commission fee | Selector | 10% / 12% / 15% — auto-calculates from Earnings |

#### Weekly Expenses (once per week)
| Field | Type | Notes |
|-------|------|-------|
| Truck Payment | Number input + toggle | Toggle: Weekly / Monthly |
| Truck Insurance | Number input | Weekly amount |
| Trailer Insurance | Number input | Weekly amount |
| Trailer Lease | Number input | Weekly amount |
| IFTA Sticker Cost | Number input | Weekly amount |
| Admin Fee | Number input | Weekly amount |
| Starting Odometer | Number input | Week start mileage reading |
| Ending Odometer | Number input | Week end mileage reading |

#### Weekly Dashboard (auto-calculated)
| Field | Formula |
|-------|---------|
| Total Earnings | Sum of all load Earnings for the week |
| Total Expenses | Weekly fixed expenses + sum of (Diesel + DEF + Commission) per load |
| Mileage (miles driven) | Ending Odometer − Starting Odometer |
| Mileage Deduction | Miles driven × $0.14 |
| Net Profit | Total Earnings − Total Expenses − Mileage Deduction |

---

### Company Driver — Per Mile

#### Add Load (per-load entry)
| Field | Type | Notes |
|-------|------|-------|
| Starting State | Text input | |
| End State / Address | Text input | |
| Paid Mileage | Number input | Total miles to be paid for this load |
| Paid amount (cents/mile) | Number input | e.g. 0.55 for $0.55/mile |

#### Weekly Dashboard (auto-calculated)
| Field | Formula |
|-------|---------|
| Total Earnings | Sum of (Paid Mileage × Paid amount) per load |
| Net Profit | Same as Total Earnings (no deductions for this driver type) |

---

### Company Driver — Commission

#### Add Load (per-load entry)
| Field | Type | Notes |
|-------|------|-------|
| Starting State | Text input | |
| End State / Address | Text input | |
| Earnings | Number input | Gross load pay |
| Commission | Selector | 20% / 25% / 30% / 35% — driver's cut of Earnings |

#### Weekly Dashboard (auto-calculated)
| Field | Formula |
|-------|---------|
| Total Earnings | Sum of (Earnings × Commission %) per load |
| Net Profit | Same as Total Earnings (no deductions for this driver type) |

---

## Data Model

### Load Entry
```ts
type LoadEntry = {
  id: string;
  weekKey: string;         // "YYYY-MM-DD" of Monday
  driverType: "owner-op" | "company-mile" | "company-commission";
  startLocation: string;
  endLocation: string;
  createdAt: string;

  // Owner Op & Company Commission
  earnings?: number;
  commissionRate?: number; // 0.10 | 0.12 | 0.15 | 0.20 | 0.25 | 0.30 | 0.35

  // Owner Op only
  diesel?: number;
  def?: number;

  // Company Per Mile only
  paidMileage?: number;    // total miles paid for this load
  centsPerMile?: number;
};
```

### Weekly Expenses (Owner Op only)
```ts
type WeeklyExpenses = {
  weekKey: string;
  truckPayment: number;
  truckPaymentFrequency: "weekly" | "monthly";
  truckInsurance: number;
  trailerInsurance: number;
  trailerLease: number;
  iftaCost: number;
  adminFee: number;
  startOdometer: number;
  endOdometer: number;
};
```

---

## Constraints & Decisions

- Week starts on **Monday**. Week key is the ISO date of that Monday.
- Truck Payment frequency toggle: if "monthly" is selected, the value is divided by 4.33 to get the weekly equivalent for expense calculations.
- Mileage deduction ($0.14/mile) is subtracted from Owner Op net profit as a per-mile operating cost.
- Company Driver types have no expense deductions in v1 — Net Profit equals Total Earnings.
- All monetary values stored as numbers (dollars). No currency conversion.
- No authentication in v1 — all data is local to the device.

---

## Out of Scope (v1)

- Backend / cloud sync
- Multi-user or dispatcher view
- PDF/CSV export
- Push notifications
- Android support (iOS first)
