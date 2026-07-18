import type { LoadEntry, WeeklyExpenses, FuelEntry, OwnerOpWeeklySummary, CompanyMileWeeklySummary, CompanyCommissionWeeklySummary, OtherFrequency } from '../types';

const toWeekly = (amount: number, freq: OtherFrequency | undefined) =>
  freq === 'monthly' ? amount / 4.33 : freq === 'daily' ? amount * 7 : amount;

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
  opts?: { mileage?: boolean }
): OwnerOpWeeklySummary {
  const expenses = normalizeExpenses(rawExpenses);
  const weekKey = expenses.weekKey;
  const totalEarnings = loads.reduce((sum, l) => sum + (l.earnings ?? 0) + (l.tonu ?? 0), 0);

  const fixedExpenses =
    toWeekly(expenses.truckPayment, expenses.truckPaymentFrequency) +
    toWeekly(expenses.truckInsurance, expenses.truckInsuranceFrequency) +
    toWeekly(expenses.trailerInsurance, expenses.trailerInsuranceFrequency) +
    toWeekly(expenses.trailerLease, expenses.trailerLeaseFrequency) +
    toWeekly(expenses.iftaCost, expenses.iftaCostFrequency) +
    toWeekly(expenses.adminFee, expenses.adminFeeFrequency) +
    (expenses.otherExpenses ?? []).reduce((s, o) => s + toWeekly(o.amount, o.frequency), 0);

  const commissionExpenses = loads.reduce(
    (sum, l) => sum + (l.earnings ?? 0) * (l.commissionRate ?? 0),
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
