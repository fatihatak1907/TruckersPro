import type { LoadEntry, WeeklyExpenses, FuelEntry, OwnerOpWeeklySummary, CompanyMileWeeklySummary, CompanyCommissionWeeklySummary } from '../types';

export function calcOwnerOpSummary(
  loads: LoadEntry[],
  expenses: WeeklyExpenses,
  fuelEntries: FuelEntry[] = []
): OwnerOpWeeklySummary {
  const weekKey = expenses.weekKey;
  const totalEarnings = loads.reduce((sum, l) => sum + (l.earnings ?? 0) + (l.tonu ?? 0), 0);

  const truckPaymentWeekly =
    expenses.truckPaymentFrequency === 'monthly'
      ? expenses.truckPayment / 4.33
      : expenses.truckPayment;

  const fixedExpenses =
    truckPaymentWeekly +
    expenses.truckInsurance +
    expenses.trailerInsurance +
    expenses.trailerLease +
    expenses.iftaCost +
    expenses.adminFee +
    (expenses.other ?? 0);

  const commissionExpenses = loads.reduce(
    (sum, l) => sum + (l.earnings ?? 0) * (l.commissionRate ?? 0),
    0
  );

  const totalDiesel = fuelEntries.filter((f) => f.type === 'diesel').reduce((s, f) => s + f.cost, 0);
  const totalDef = fuelEntries.filter((f) => f.type === 'def').reduce((s, f) => s + f.cost, 0);
  const fuelTotal = totalDiesel + totalDef;

  const totalExpenses = fixedExpenses + commissionExpenses + fuelTotal;
  const milesDriven = expenses.endOdometer - expenses.startOdometer;
  const mileageDeduction = milesDriven * 0.14;
  const netProfit = totalEarnings - totalExpenses - mileageDeduction;

  return { weekKey, totalEarnings, totalExpenses, totalDiesel, totalDef, milesDriven, mileageDeduction, netProfit };
}

export function calcCompanyMileSummary(loads: LoadEntry[]): CompanyMileWeeklySummary {
  const weekKey = loads[0]?.weekKey ?? '';
  const totalEarnings = loads.reduce(
    (sum, l) => sum + (l.paidMileage ?? 0) * (l.centsPerMile ?? 0),
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
