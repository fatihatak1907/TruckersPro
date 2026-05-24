import type { LoadEntry, WeeklyExpenses, OwnerOpWeeklySummary, CompanyMileWeeklySummary, CompanyCommissionWeeklySummary } from '../types';

export function calcOwnerOpSummary(
  loads: LoadEntry[],
  expenses: WeeklyExpenses
): OwnerOpWeeklySummary {
  const weekKey = expenses.weekKey;

  const totalEarnings = loads.reduce((sum, l) => sum + (l.earnings ?? 0), 0);

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
    expenses.adminFee;

  const perLoadExpenses = loads.reduce((sum, l) => {
    const commission = (l.earnings ?? 0) * (l.commissionRate ?? 0);
    return sum + (l.diesel ?? 0) + (l.def ?? 0) + commission;
  }, 0);

  const totalExpenses = fixedExpenses + perLoadExpenses;
  const milesDriven = expenses.endOdometer - expenses.startOdometer;
  const mileageDeduction = milesDriven * 0.14;
  const netProfit = totalEarnings - totalExpenses - mileageDeduction;

  return { weekKey, totalEarnings, totalExpenses, milesDriven, mileageDeduction, netProfit };
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
