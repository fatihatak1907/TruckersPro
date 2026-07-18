import {
  calcOwnerOpSummary,
  calcCompanyMileSummary,
  calcCompanyCommissionSummary,
  normalizeExpenses,
} from '../src/utils/calculations';
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../src/types';

const weekKey = '2026-05-25';

describe('calcOwnerOpSummary', () => {
  const loads: LoadEntry[] = [
    {
      id: '1', weekKey, driverType: 'owner-op',
      startLocation: 'TX', endLocation: 'CA',
      createdAt: '2026-05-25',
      earnings: 3000, commissionRate: 0.10,
    },
    {
      id: '2', weekKey, driverType: 'owner-op',
      startLocation: 'CA', endLocation: 'AZ',
      createdAt: '2026-05-26',
      earnings: 1500, commissionRate: 0.12,
    },
  ];
  const fuel: FuelEntry[] = [
    { id: 'f1', weekKey, type: 'diesel', cost: 400, createdAt: '2026-05-25T10:00:00Z' },
    { id: 'f2', weekKey, type: 'def',    cost: 30,  createdAt: '2026-05-25T10:05:00Z' },
    { id: 'f3', weekKey, type: 'diesel', cost: 200, createdAt: '2026-05-26T10:00:00Z' },
    { id: 'f4', weekKey, type: 'def',    cost: 15,  createdAt: '2026-05-26T10:05:00Z' },
  ];
  const expenses: WeeklyExpenses = {
    weekKey,
    truckPayment: 600, truckPaymentFrequency: 'weekly',
    truckInsurance: 250, truckInsuranceFrequency: 'weekly',
    trailerInsurance: 80, trailerInsuranceFrequency: 'weekly',
    trailerLease: 200, trailerLeaseFrequency: 'weekly',
    iftaCost: 50, iftaCostFrequency: 'weekly',
    adminFee: 40, adminFeeFrequency: 'weekly',
    other: 0, otherFrequency: 'weekly',
    startOdometer: 100000, endOdometer: 103500,
  };

  it('calculates totalEarnings', () => {
    const result = calcOwnerOpSummary(loads, expenses, fuel);
    expect(result.totalEarnings).toBe(4500); // 3000 + 1500
  });

  it('calculates totalExpenses = fixed + commission + fuel', () => {
    const result = calcOwnerOpSummary(loads, expenses, fuel);
    // fixed = 600+250+80+200+50+40 = 1220
    // commission = 3000*0.10 + 1500*0.12 = 480
    // fuel = 400+30+200+15 = 645
    expect(result.totalExpenses).toBe(2345);
    expect(result.totalDiesel).toBe(600);
    expect(result.totalDef).toBe(45);
  });

  it('calculates mileage deduction', () => {
    const result = calcOwnerOpSummary(loads, expenses, fuel);
    expect(result.milesDriven).toBe(3500);
    expect(result.mileageDeduction).toBeCloseTo(490, 1); // 3500 * 0.14
  });

  it('calculates net profit', () => {
    const result = calcOwnerOpSummary(loads, expenses, fuel);
    // 4500 - 2345 - 490 = 1665
    expect(result.netProfit).toBeCloseTo(1665, 0);
  });

  it('handles monthly truck payment by dividing by 4.33', () => {
    const monthlyExpenses = { ...expenses, truckPaymentFrequency: 'monthly' as const };
    const result = calcOwnerOpSummary(loads, monthlyExpenses, fuel);
    const fixedExpenses = 600 / 4.33 + 250 + 80 + 200 + 50 + 40;
    expect(result.totalExpenses).toBeCloseTo(fixedExpenses + 480 + 645, 1);
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

describe('company-mile extra mileage', () => {
  test('extra mileage paid at the same rate', () => {
    const s = calcCompanyMileSummary([
      { id: '1', weekKey: '2026-07-13', driverType: 'company-mile', startLocation: 'A, TX', endLocation: 'B, TX', createdAt: '', paidMileage: 500, centsPerMile: 0.55, extraMileage: 50 },
    ] as any);
    expect(s.totalEarnings).toBeCloseTo(302.5);
  });
  test('absent extra mileage unchanged', () => {
    const s = calcCompanyMileSummary([
      { id: '1', weekKey: '2026-07-13', driverType: 'company-mile', startLocation: 'A, TX', endLocation: 'B, TX', createdAt: '', paidMileage: 500, centsPerMile: 0.55 },
    ] as any);
    expect(s.totalEarnings).toBeCloseTo(275);
  });
});

describe('once frequency + mileage options', () => {
  const base = {
    weekKey: '2026-07-13',
    truckPayment: 0, truckPaymentFrequency: 'weekly' as const,
    truckInsurance: 0, truckInsuranceFrequency: 'weekly' as const,
    trailerInsurance: 0, trailerInsuranceFrequency: 'weekly' as const,
    trailerLease: 0, trailerLeaseFrequency: 'weekly' as const,
    iftaCost: 0, iftaCostFrequency: 'weekly' as const,
    adminFee: 0, adminFeeFrequency: 'weekly' as const,
    other: 0, otherFrequency: 'weekly' as const,
    otherExpenses: [],
    startOdometer: 0, endOdometer: 0,
  };

  test('once expense counts fully in its week', () => {
    const s = calcOwnerOpSummary([], {
      ...base,
      otherExpenses: [{ id: 'x', label: 'Repair', amount: 300, frequency: 'once' as const }],
    });
    expect(s.totalExpenses).toBeCloseTo(300);
  });

  test('mileage: false zeroes miles and deduction', () => {
    const s = calcOwnerOpSummary([], { ...base, startOdometer: 1000, endOdometer: 2000 }, [], { mileage: false });
    expect(s.milesDriven).toBe(0);
    expect(s.mileageDeduction).toBe(0);
  });

  test('custom mileageRate is used', () => {
    const s = calcOwnerOpSummary([], { ...base, startOdometer: 0, endOdometer: 100, mileageRate: 0.2 });
    expect(s.mileageDeduction).toBeCloseTo(20);
  });

  test('default rate 0.14 when mileageRate absent', () => {
    const s = calcOwnerOpSummary([], { ...base, startOdometer: 0, endOdometer: 100 });
    expect(s.mileageDeduction).toBeCloseTo(14);
  });

  test('normalizeExpenses defaults mileageRate to 0.14', () => {
    expect(normalizeExpenses(base).mileageRate).toBe(0.14);
    expect(normalizeExpenses({ ...base, mileageRate: 0.2 }).mileageRate).toBe(0.2);
    expect(normalizeExpenses({ ...base, mileageRate: 0 }).mileageRate).toBe(0.14);
  });
});
