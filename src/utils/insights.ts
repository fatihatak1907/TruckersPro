import type { LoadEntry, WeeklyExpenses, FuelEntry, Frequency } from '../types';
import { calcOwnerOpSummary } from './calculations';
import { fmt } from './format';

export type InsightKind = 'net' | 'earnings' | 'expenses' | 'diesel' | 'def' | 'miles' | 'deduction';

export type InsightRow = { label: string; value: string; sub?: string };

export type WeekData = {
  loads: LoadEntry[];
  expenses: WeeklyExpenses;
  fuelEntries: FuelEntry[];
};

export type InsightChange = { delta: number; pct: number | null } | null;

export type Insight = {
  title: string;
  headline: string;
  rows: InsightRow[];
  footer: InsightRow[];
  change: InsightChange;
  unit: 'currency' | 'miles';
  higherIsBad: boolean;
};

const COST_KINDS: InsightKind[] = ['expenses', 'diesel', 'def', 'deduction'];

const TITLES: Record<InsightKind, string> = {
  net: 'Net Profit',
  earnings: 'Earnings',
  expenses: 'Total Expenses',
  diesel: 'Diesel',
  def: 'DEF',
  miles: 'Miles Driven',
  deduction: 'Mileage Deduction',
};

const toWeekly = (amount: number, freq: Frequency | undefined) =>
  freq === 'monthly' ? amount / 4.33 : amount;

function metric(kind: InsightKind, w: WeekData): number {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries);
  switch (kind) {
    case 'net': return s.netProfit;
    case 'earnings': return s.totalEarnings;
    case 'expenses': return s.totalExpenses;
    case 'diesel': return s.totalDiesel;
    case 'def': return s.totalDef;
    case 'miles': return s.milesDriven;
    case 'deduction': return s.mileageDeduction;
  }
}

function hasData(w: WeekData): boolean {
  const e = w.expenses;
  const anyExpense =
    e.truckPayment + e.truckInsurance + e.trailerInsurance + e.trailerLease +
    e.iftaCost + e.adminFee + (e.other ?? 0) > 0;
  const anyOdometer = e.endOdometer > e.startOdometer;
  return w.loads.length > 0 || w.fuelEntries.length > 0 || anyExpense || anyOdometer;
}

function computeChange(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null): InsightChange {
  if (!lastWeek || !hasData(lastWeek)) return null;
  const cur = metric(kind, thisWeek);
  const prev = metric(kind, lastWeek);
  return { delta: cur - prev, pct: prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null };
}

const miles = (w: WeekData) => w.expenses.endOdometer - w.expenses.startOdometer;

const fuelDate = (f: FuelEntry) =>
  new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function expenseRows(w: WeekData): InsightRow[] {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries);
  const e = w.expenses;
  const commission = w.loads.reduce((sum, l) => sum + (l.earnings ?? 0) * (l.commissionRate ?? 0), 0);

  const items: { label: string; weekly: number; freq: Frequency }[] = [
    { label: 'Truck payment', weekly: toWeekly(e.truckPayment, e.truckPaymentFrequency), freq: e.truckPaymentFrequency },
    { label: 'Truck insurance', weekly: toWeekly(e.truckInsurance, e.truckInsuranceFrequency), freq: e.truckInsuranceFrequency },
    { label: 'Trailer insurance', weekly: toWeekly(e.trailerInsurance, e.trailerInsuranceFrequency), freq: e.trailerInsuranceFrequency },
    { label: 'Trailer lease', weekly: toWeekly(e.trailerLease, e.trailerLeaseFrequency), freq: e.trailerLeaseFrequency },
    { label: 'IFTA', weekly: toWeekly(e.iftaCost, e.iftaCostFrequency), freq: e.iftaCostFrequency },
    { label: 'Admin fee', weekly: toWeekly(e.adminFee, e.adminFeeFrequency), freq: e.adminFeeFrequency },
    { label: 'Other', weekly: toWeekly(e.other ?? 0, e.otherFrequency), freq: e.otherFrequency },
    { label: 'Commission', weekly: commission, freq: 'weekly' },
    { label: 'Diesel', weekly: s.totalDiesel, freq: 'weekly' },
    { label: 'DEF', weekly: s.totalDef, freq: 'weekly' },
  ];

  return items
    .filter((i) => i.weekly > 0)
    .map((i) => {
      const pct = s.totalExpenses > 0 ? `${Math.round((i.weekly / s.totalExpenses) * 100)}% of expenses` : '';
      const monthly = i.freq === 'monthly' ? 'monthly ÷ 4.33' : '';
      const sub = [pct, monthly].filter(Boolean).join(' · ');
      return { label: i.label, value: fmt(i.weekly), ...(sub ? { sub } : {}) };
    });
}

export function buildInsight(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null): Insight {
  const s = calcOwnerOpSummary(thisWeek.loads, thisWeek.expenses, thisWeek.fuelEntries);
  const mi = miles(thisWeek);
  const change = computeChange(kind, thisWeek, lastWeek);
  let headline = fmt(metric(kind, thisWeek));
  let rows: InsightRow[] = [];
  const footer: InsightRow[] = [];

  switch (kind) {
    case 'expenses': {
      rows = expenseRows(thisWeek);
      if (s.totalEarnings > 0)
        footer.push({ label: '% of earnings', value: `${Math.round((s.totalExpenses / s.totalEarnings) * 100)}%` });
      if (mi > 0)
        footer.push({ label: 'Cost per mile', value: `${fmt(s.totalExpenses / mi)}/mi` });
      break;
    }
    case 'earnings': {
      rows = thisWeek.loads.map((l) => ({
        label: `${l.startLocation} → ${l.endLocation}`,
        value: fmt(l.earnings ?? 0),
        ...((l.tonu ?? 0) > 0 ? { sub: `+ ${fmt(l.tonu ?? 0)} TONU` } : {}),
      }));
      if (mi > 0)
        footer.push({ label: 'Earnings per mile', value: `${fmt(s.totalEarnings / mi)}/mi` });
      break;
    }
    case 'diesel':
    case 'def': {
      const entries = thisWeek.fuelEntries.filter((f) => f.type === kind);
      rows = entries.map((f) => ({ label: fuelDate(f), value: fmt(f.cost) }));
      const total = kind === 'diesel' ? s.totalDiesel : s.totalDef;
      if (mi > 0 && total > 0)
        footer.push({ label: 'Cost per mile', value: `${fmt(total / mi)}/mi` });
      break;
    }
    case 'miles': {
      headline = `${mi.toLocaleString()} mi`;
      rows = [
        { label: 'Start odometer', value: thisWeek.expenses.startOdometer.toLocaleString() },
        { label: 'End odometer', value: thisWeek.expenses.endOdometer.toLocaleString() },
        { label: 'Miles driven', value: `${mi.toLocaleString()} mi` },
      ];
      break;
    }
    case 'deduction': {
      rows = [{ label: `${mi.toLocaleString()} mi × $0.14`, value: fmt(s.mileageDeduction) }];
      break;
    }
    case 'net': {
      rows = [
        { label: 'Earnings', value: fmt(s.totalEarnings) },
        { label: 'Expenses', value: `− ${fmt(s.totalExpenses)}` },
        { label: 'Mileage deduction', value: `− ${fmt(s.mileageDeduction)}` },
        { label: 'Net profit', value: fmt(s.netProfit) },
      ];
      if (s.totalEarnings > 0)
        footer.push({ label: 'Profit margin', value: `${Math.round((s.netProfit / s.totalEarnings) * 100)}%` });
      break;
    }
  }

  const unit: 'currency' | 'miles' = kind === 'miles' ? 'miles' : 'currency';
  const higherIsBad = COST_KINDS.includes(kind);
  return { title: TITLES[kind], headline, rows, footer, change, unit, higherIsBad };
}
