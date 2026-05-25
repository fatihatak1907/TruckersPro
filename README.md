# TruckersPro

A React Native / Expo mobile app for truckers to track weekly earnings and expenses. Supports three driver modes, each with dedicated dashboards, load entry, and history.

## Driver Modes

| Mode | What it tracks |
|------|---------------|
| **Owner Operator** | Earnings, TONU, commission, diesel/DEF fuel, insurance, truck payment, trailer lease, IFTA, admin fees, mileage deduction |
| **Company Driver — Per Mile** | Paid mileage × cents-per-mile rate |
| **Company Driver — Commission** | Gross earnings × commission rate |

## Features

- Weekly earnings & expense dashboard with net profit summary
- Load entry with edit/delete support
- Week-by-week navigation (prev/next) across all tabs simultaneously
- Owner-op fuel log (diesel + DEF) tracked separately per week
- Weekly expenses with monthly truck payment auto-conversion (÷ 4.33)
- Mileage deduction calculated from odometer readings ($0.14/mi)
- Full load history across all past weeks
- Offline-first — all data stored locally via AsyncStorage

## Stack

- [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/) + React Native
- TypeScript (strict mode)
- React Navigation (Stack + Tabs)
- AsyncStorage for persistence
- Jest + jest-expo for tests

## Getting Started

```bash
npm install --legacy-peer-deps
npx expo start
```

Scan the QR code with [Expo Go](https://expo.dev/go) on your device.

### Run tests

```bash
npm test
```

## Project Structure

```
src/
├── components/       # CurrencyInput, CommissionSelector, SummaryCard
├── context/          # WeekContext — shared week navigation state
├── navigation/       # Root stack + per-mode tab navigators
├── screens/          # owner-op/, company-mile/, company-commission/, HomeScreen
├── storage/          # AsyncStorage wrapper
├── types/            # Shared TypeScript types
├── utils/            # calculations.ts (pure), weekKey.ts
└── theme.ts          # Color palette and shadow constants
```
