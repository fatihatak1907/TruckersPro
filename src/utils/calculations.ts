import type { LoadEntry, WeeklyExpenses, FuelEntry, OwnerOpWeeklySummary, CompanyMileWeeklySummary, CompanyCommissionWeeklySummary, Frequency, OtherFrequency } from '../types';

export type CalcPeriod = { days: number; isMonth: boolean };

const WEEKLY_PERIOD: CalcPeriod = { days: 7, isMonth: false };

export function toPeriod(
  amount: number,
  freq: Frequency | OtherFrequency | undefined,
  period: CalcPeriod
): number {
  switch (freq) {
    case 'once':
      return amount;
    case 'daily':
      return amount * period.days;
    case 'biweekly':
      return amount * (period.days / 14);
    case 'monthly':
      return period.isMonth ? amount : (amount * (period.days / 7)) / 4.33;
    default: // 'weekly' or undefined
      return amount * (period.days / 7);
  }
}

export function normalizeExpenses(e: WeeklyExpenses): WeeklyExpenses {
  const otherExpenses = e.otherExpenses ?? [];
  const mileageRate = e.mileageRate && e.mileageRate > 0 ? e.mileageRate : 0.14;
  if ((e.other ?? 0) > 0 && otherExpenses.length === 0) {
    return {
      ...e,
      other: 0,
      otherFrequency: 'weekly',
      otherExpenses: [
        { id: 'legacy-other', label: 'Other', amount: e.other ?? 0, frequency: e.otherFrequency ?? 'weekly' },
      ],
      mileageRate,
    };
  }
  return { ...e, otherExpenses, mileageRate };
}

export function calcOwnerOpSummary(
  loads: LoadEntry[],
  rawExpenses: WeeklyExpenses,
  fuelEntries: FuelEntry[] = [],
  opts?: { mileage?: boolean; period?: CalcPeriod }
): OwnerOpWeeklySummary {
  const expenses = normalizeExpenses(rawExpenses);
  const period = opts?.period ?? WEEKLY_PERIOD;
  const weekKey = expenses.weekKey;
  const totalEarnings = loads.reduce((sum, l) => sum + (l.earnings ?? 0) + (l.tonu ?? 0), 0);

  const fixedExpenses =
    toPeriod(expenses.truckPayment, expenses.truckPaymentFrequency, period) +
    toPeriod(expenses.truckInsurance, expenses.truckInsuranceFrequency, period) +
    toPeriod(expenses.trailerInsurance, expenses.trailerInsuranceFrequency, period) +
    toPeriod(expenses.trailerLease, expenses.trailerLeaseFrequency, period) +
    toPeriod(expenses.iftaCost, expenses.iftaCostFrequency, period) +
    toPeriod(expenses.toll ?? 0, expenses.tollFrequency, period) +
    toPeriod(expenses.adminFee, expenses.adminFeeFrequency, period) +
    (expenses.otherExpenses ?? []).reduce((s, o) => s + toPeriod(o.amount, o.frequency, period), 0);

  const commissionExpenses = loads.reduce(
    (sum, l) => sum + (l.earnings ?? 0) * ((l.commissionRate ?? 0) + (l.customerCommissionRate ?? 0)),
    0
  );

  const totalDiesel = fuelEntries.filter((f) => f.type === 'diesel').reduce((s, f) => s + f.cost, 0);
  const totalDef = fuelEntries.filter((f) => f.type === 'def').reduce((s, f) => s + f.cost, 0);
  const fuelTotal = totalDiesel + totalDef;

  const totalExpenses = fixedExpenses + commissionExpenses + fuelTotal;
  const mileageOn = opts?.mileage !== false;
  const milesDriven = mileageOn ? expenses.endOdometer - expenses.startOdometer : 0;
  const mileageDeduction = milesDriven * (expenses.mileageRate ?? 0.14);
  const netProfit = totalEarnings - totalExpenses - mileageDeduction;

  return { weekKey, totalEarnings, totalExpenses, totalDiesel, totalDef, milesDriven, mileageDeduction, netProfit };
}

export function calcCompanyMileSummary(loads: LoadEntry[]): CompanyMileWeeklySummary {
  const weekKey = loads[0]?.weekKey ?? '';
  const totalEarnings = loads.reduce(
    (sum, l) => sum + ((l.paidMileage ?? 0) + (l.extraMileage ?? 0)) * (l.centsPerMile ?? 0),
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
