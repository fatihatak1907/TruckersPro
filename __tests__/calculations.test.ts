import {
  calcOwnerOpSummary,
  calcCompanyMileSummary,
  calcCompanyCommissionSummary,
} from '../src/utils/calculations';
import type { LoadEntry, WeeklyExpenses } from '../src/types';

const weekKey = '2026-05-25';

describe('calcOwnerOpSummary', () => {
  const loads: LoadEntry[] = [
    {
      id: '1', weekKey, driverType: 'owner-op',
      startLocation: 'TX', endLocation: 'CA',
      createdAt: '2026-05-25',
      earnings: 3000, commissionRate: 0.10, diesel: 400, def: 30,
    },
    {
      id: '2', weekKey, driverType: 'owner-op',
      startLocation: 'CA', endLocation: 'AZ',
      createdAt: '2026-05-26',
      earnings: 1500, commissionRate: 0.12, diesel: 200, def: 15,
    },
  ];
  const expenses: WeeklyExpenses = {
    weekKey,
    truckPayment: 600, truckPaymentFrequency: 'weekly',
    truckInsurance: 250, trailerInsurance: 80,
    trailerLease: 200, iftaCost: 50, adminFee: 40,
    startOdometer: 100000, endOdometer: 103500,
  };

  it('calculates totalEarnings', () => {
    const result = calcOwnerOpSummary(loads, expenses);
    expect(result.totalEarnings).toBe(4500); // 3000 + 1500
  });

  it('calculates commissions per load', () => {
    // Load 1: 3000 * 0.10 = 300, Load 2: 1500 * 0.12 = 180
    const result = calcOwnerOpSummary(loads, expenses);
    // totalExpenses = fixed(600+250+80+200+50+40) + perLoad(400+30+300 + 200+15+180)
    // fixed = 1220, perLoad = 1125, total = 2345
    expect(result.totalExpenses).toBe(2345);
  });

  it('calculates mileage deduction', () => {
    const result = calcOwnerOpSummary(loads, expenses);
    expect(result.milesDriven).toBe(3500);
    expect(result.mileageDeduction).toBeCloseTo(490, 1); // 3500 * 0.14
  });

  it('calculates net profit', () => {
    const result = calcOwnerOpSummary(loads, expenses);
    // 4500 - 2345 - 490 = 1665
    expect(result.netProfit).toBeCloseTo(1665, 0);
  });

  it('handles monthly truck payment by dividing by 4.33', () => {
    const monthlyExpenses = { ...expenses, truckPaymentFrequency: 'monthly' as const };
    const result = calcOwnerOpSummary(loads, monthlyExpenses);
    const weeklyTruckPayment = 600 / 4.33;
    const fixedExpenses = weeklyTruckPayment + 250 + 80 + 200 + 50 + 40;
    const perLoadExpenses = 400 + 30 + 300 + 200 + 15 + 180;
    expect(result.totalExpenses).toBeCloseTo(fixedExpenses + perLoadExpenses, 1);
  });
});

describe('calcCompanyMileSummary', () => {
  const loads: LoadEntry[] = [
    {
      id: '1', weekKey, driverType: 'company-mile',
      startLocation: 'TX', endLocation: 'OK', createdAt: '2026-05-25',
      paidMileage: 500, centsPerMile: 0.55,
    },
    {
      id: '2', weekKey, driverType: 'company-mile',
      startLocation: 'OK', endLocation: 'MO', createdAt: '2026-05-26',
      paidMileage: 300, centsPerMile: 0.55,
    },
  ];

  it('calculates totalEarnings', () => {
    const result = calcCompanyMileSummary(loads);
    expect(result.totalEarnings).toBeCloseTo(440, 2); // (500+300)*0.55
  });

  it('sets netProfit equal to totalEarnings', () => {
    const result = calcCompanyMileSummary(loads);
    expect(result.netProfit).toBe(result.totalEarnings);
  });
});

describe('calcCompanyCommissionSummary', () => {
  const loads: LoadEntry[] = [
    {
      id: '1', weekKey, driverType: 'company-commission',
      startLocation: 'TX', endLocation: 'FL', createdAt: '2026-05-25',
      earnings: 2000, commissionRate: 0.25,
    },
    {
      id: '2', weekKey, driverType: 'company-commission',
      startLocation: 'FL', endLocation: 'GA', createdAt: '2026-05-26',
      earnings: 1000, commissionRate: 0.30,
    },
  ];

  it('calculates totalEarnings as sum of driver cuts', () => {
    const result = calcCompanyCommissionSummary(loads);
    expect(result.totalEarnings).toBeCloseTo(800, 2); // 2000*0.25 + 1000*0.30
  });

  it('sets netProfit equal to totalEarnings', () => {
    const result = calcCompanyCommissionSummary(loads);
    expect(result.netProfit).toBe(result.totalEarnings);
  });
});
