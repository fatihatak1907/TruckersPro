import type { LoadEntry, WeeklyExpenses, FuelEntry, Frequency, OtherFrequency } from '../types';
import { calcOwnerOpSummary, normalizeExpenses, toPeriod, CalcPeriod } from './calculations';
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

type CalcOpts = { mileage?: boolean; period?: CalcPeriod };

function metric(kind: InsightKind, w: WeekData, opts?: CalcOpts): number {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries, opts);
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
  const e = normalizeExpenses(w.expenses);
  const anyExpense =
    e.truckPayment + e.truckInsurance + e.trailerInsurance + e.trailerLease +
    e.iftaCost + e.adminFee +
    (e.otherExpenses ?? []).reduce((s, o) => s + o.amount, 0) > 0;
  const anyOdometer = e.endOdometer > e.startOdometer;
  return w.loads.length > 0 || w.fuelEntries.length > 0 || anyExpense || anyOdometer;
}

function computeChange(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null, opts?: CalcOpts): InsightChange {
  if (!lastWeek || !hasData(lastWeek)) return null;
  const cur = metric(kind, thisWeek, opts);
  const prev = metric(kind, lastWeek, opts);
  return { delta: cur - prev, pct: prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : null };
}

const miles = (w: WeekData) => w.expenses.endOdometer - w.expenses.startOdometer;

const fuelDate = (f: FuelEntry) =>
  new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function expenseRows(w: WeekData, opts?: CalcOpts): InsightRow[] {
  const s = calcOwnerOpSummary(w.loads, w.expenses, w.fuelEntries, opts);
  const e = normalizeExpenses(w.expenses);
  const period = opts?.period ?? { days: 7, isMonth: false };
  const isWeeklyPeriod = period.days === 7 && !period.isMonth;
  const commission = w.loads.reduce((sum, l) => sum + (l.earnings ?? 0) * (l.commissionRate ?? 0), 0);

  const items: { label: string; converted: number; freq: Frequency | OtherFrequency; actual?: boolean }[] = [
    { label: 'Truck payment', converted: toPeriod(e.truckPayment, e.truckPaymentFrequency, period), freq: e.truckPaymentFrequency },
    { label: 'Truck insurance', converted: toPeriod(e.truckInsurance, e.truckInsuranceFrequency, period), freq: e.truckInsuranceFrequency },
    { label: 'Trailer insurance', converted: toPeriod(e.trailerInsurance, e.trailerInsuranceFrequency, period), freq: e.trailerInsuranceFrequency },
    { label: 'Trailer lease', converted: toPeriod(e.trailerLease, e.trailerLeaseFrequency, period), freq: e.trailerLeaseFrequency },
    { label: 'IFTA', converted: toPeriod(e.iftaCost, e.iftaCostFrequency, period), freq: e.iftaCostFrequency },
    { label: 'Admin fee', converted: toPeriod(e.adminFee, e.adminFeeFrequency, period), freq: e.adminFeeFrequency },
    ...(e.otherExpenses ?? []).map((o) => ({
      label: o.label, converted: toPeriod(o.amount, o.frequency, period), freq: o.frequency,
    })),
    { label: 'Commission', converted: commission, freq: 'weekly' as const, actual: true },
    { label: 'Diesel', converted: s.totalDiesel, freq: 'weekly' as const, actual: true },
    { label: 'DEF', converted: s.totalDef, freq: 'weekly' as const, actual: true },
  ];

  return items
    .filter((i) => i.converted > 0)
    .map((i) => {
      const pct = s.totalExpenses > 0 ? `${Math.round((i.converted / s.totalExpenses) * 100)}% of expenses` : '';
      const freqNote = i.actual
        ? ''
        : i.freq === 'once'
          ? 'one-time'
          : !isWeeklyPeriod
            ? 'per period'
            : i.freq === 'monthly'
              ? 'monthly ÷ 4.33'
              : i.freq === 'daily'
                ? 'daily × 7'
                : '';
      const sub = [pct, freqNote].filter(Boolean).join(' · ');
      return { label: i.label, value: fmt(i.converted), ...(sub ? { sub } : {}) };
    });
}

export function buildInsight(kind: InsightKind, thisWeek: WeekData, lastWeek: WeekData | null, opts?: CalcOpts): Insight {
  const s = calcOwnerOpSummary(thisWeek.loads, thisWeek.expenses, thisWeek.fuelEntries, opts);
  const mi = miles(thisWeek);
  const change = computeChange(kind, thisWeek, lastWeek, opts);
  let headline = fmt(metric(kind, thisWeek, opts));
  let rows: InsightRow[] = [];
  const footer: InsightRow[] = [];

  switch (kind) {
    case 'expenses': {
      rows = expenseRows(thisWeek, opts);
      if (s.totalEarnings > 0)
        footer.push({ label: '% of earnings', value: `${Math.round((s.totalExpenses / s.totalEarnings) * 100)}%` });
      if (s.milesDriven > 0)
        footer.push({ label: 'Cost per mile', value: `${fmt(s.totalExpenses / s.milesDriven)}/mi` });
      break;
    }
    case 'earnings': {
      rows = thisWeek.loads.map((l) => ({
        label: `${l.startLocation} → ${l.endLocation}`,
        value: fmt(l.earnings ?? 0),
        ...((l.tonu ?? 0) > 0 ? { sub: `+ ${fmt(l.tonu ?? 0)} TONU` } : {}),
      }));
      if (s.milesDriven > 0)
        footer.push({ label: 'Earnings per mile', value: `${fmt(s.totalEarnings / s.milesDriven)}/mi` });
      break;
    }
    case 'diesel':
    case 'def': {
      const entries = thisWeek.fuelEntries.filter((f) => f.type === kind);
      rows = entries.map((f) => ({ label: fuelDate(f), value: fmt(f.cost) }));
      const total = kind === 'diesel' ? s.totalDiesel : s.totalDef;
      if (s.milesDriven > 0 && total > 0)
        footer.push({ label: 'Cost per mile', value: `${fmt(total / s.milesDriven)}/mi` });
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
      const rate = normalizeExpenses(thisWeek.expenses).mileageRate ?? 0.14;
      rows = [{ label: `${s.milesDriven.toLocaleString()} mi × $${rate.toFixed(2)}`, value: fmt(s.mileageDeduction) }];
      break;
    }
    case 'net': {
      rows = [
        { label: 'Earnings', value: fmt(s.totalEarnings) },
        { label: 'Expenses', value: `− ${fmt(s.totalExpenses)}` },
        ...(opts?.mileage === false
          ? []
          : [{ label: 'Mileage deduction', value: `− ${fmt(s.mileageDeduction)}` }]),
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
