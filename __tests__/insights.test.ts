import { buildInsight, WeekData } from '../src/utils/insights';
import type { WeeklyExpenses, LoadEntry, FuelEntry } from '../src/types';

function makeExpenses(over: Partial<WeeklyExpenses> = {}): WeeklyExpenses {
  return {
    weekKey: '2026-07-13',
    truckPayment: 0, truckPaymentFrequency: 'weekly',
    truckInsurance: 0, truckInsuranceFrequency: 'weekly',
    trailerInsurance: 0, trailerInsuranceFrequency: 'weekly',
    trailerLease: 0, trailerLeaseFrequency: 'weekly',
    iftaCost: 0, iftaCostFrequency: 'weekly',
    adminFee: 0, adminFeeFrequency: 'weekly',
    other: 0, otherFrequency: 'weekly',
    startOdometer: 0, endOdometer: 0,
    ...over,
  };
}

function makeLoad(over: Partial<LoadEntry> = {}): LoadEntry {
  return {
    id: 'l1', weekKey: '2026-07-13', driverType: 'owner-op',
    startLocation: 'Dallas', endLocation: 'Houston',
    createdAt: '2026-07-13T10:00:00Z', earnings: 1000, commissionRate: 0.1,
    ...over,
  };
}

function makeFuel(over: Partial<FuelEntry> = {}): FuelEntry {
  return { id: 'f1', weekKey: '2026-07-13', type: 'diesel', cost: 300, createdAt: '2026-07-13T12:00:00Z', ...over };
}

function week(over: Partial<WeekData> = {}): WeekData {
  return { loads: [], expenses: makeExpenses(), fuelEntries: [], ...over };
}

describe('expenses insight', () => {
  const thisWeek = week({
    loads: [makeLoad()],
    expenses: makeExpenses({ truckPayment: 433, truckPaymentFrequency: 'monthly', adminFee: 50, startOdometer: 1000, endOdometer: 2000 }),
    fuelEntries: [makeFuel({ type: 'diesel', cost: 300 }), makeFuel({ id: 'f2', type: 'def', cost: 40 })],
  });
  const insight = buildInsight('expenses', thisWeek, null);

  it('includes Diesel and DEF rows', () => {
    const labels = insight.rows.map((r) => r.label);
    expect(labels).toContain('Diesel');
    expect(labels).toContain('DEF');
  });

  it('headline equals fixed + commission + fuel', () => {
    // 433/4.33=100 truck, 50 admin, 100 commission, 300 diesel, 40 def = 590
    expect(insight.headline).toBe('$590.00');
  });

  it('weekly-izes monthly items and labels them', () => {
    const truck = insight.rows.find((r) => r.label === 'Truck payment')!;
    expect(truck.value).toBe('$100.00');
    expect(truck.sub).toContain('÷ 4.33');
  });

  it('shows % of total on rows', () => {
    const diesel = insight.rows.find((r) => r.label === 'Diesel')!;
    expect(diesel.sub).toContain('51%'); // 300/590
  });

  it('omits zero-amount lines', () => {
    expect(insight.rows.map((r) => r.label)).not.toContain('Trailer lease');
  });

  it('footer has % of earnings and cost per mile', () => {
    expect(insight.footer.find((r) => r.label === '% of earnings')!.value).toBe('59%'); // 590/1000
    expect(insight.footer.find((r) => r.label === 'Cost per mile')!.value).toBe('$0.59/mi'); // 590/1000mi
  });

  it('omits per-mile footer when miles is 0', () => {
    const noMiles = week({ loads: [makeLoad()], fuelEntries: [makeFuel()] });
    const i = buildInsight('expenses', noMiles, null);
    expect(i.footer.find((r) => r.label === 'Cost per mile')).toBeUndefined();
  });
});

describe('change vs last week', () => {
  it('is null when there is no last-week data', () => {
    expect(buildInsight('expenses', week({ fuelEntries: [makeFuel()] }), null).change).toBeNull();
    expect(buildInsight('expenses', week({ fuelEntries: [makeFuel()] }), week()).change).toBeNull();
  });

  it('computes delta and pct against last week', () => {
    const cur = week({ fuelEntries: [makeFuel({ cost: 300 })] });
    const prev = week({ fuelEntries: [makeFuel({ cost: 200 })] });
    const c = buildInsight('expenses', cur, prev).change!;
    expect(c.delta).toBeCloseTo(100);
    expect(c.pct).toBeCloseTo(50);
  });

  it('pct is null when last week metric was 0 but data existed', () => {
    const prev = week({ loads: [makeLoad({ earnings: 500, commissionRate: 0 })] }); // has data, 0 expenses
    const c = buildInsight('expenses', week({ fuelEntries: [makeFuel()] }), prev)!.change!;
    expect(c.pct).toBeNull();
  });
});
