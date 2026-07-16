import { normalizeExpenses, calcOwnerOpSummary } from '../src/utils/calculations';
import type { WeeklyExpenses } from '../src/types';

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

describe('normalizeExpenses', () => {
  it('defaults missing otherExpenses to []', () => {
    expect(normalizeExpenses(makeExpenses()).otherExpenses).toEqual([]);
  });

  it('converts legacy other into one named entry and zeroes the legacy field', () => {
    const n = normalizeExpenses(makeExpenses({ other: 75, otherFrequency: 'monthly' }));
    expect(n.otherExpenses).toEqual([
      { id: 'legacy-other', label: 'Other', amount: 75, frequency: 'monthly' },
    ]);
    expect(n.other).toBe(0);
    expect(n.otherFrequency).toBe('weekly');
  });

  it('passes through already-migrated rows untouched (no legacy double-count)', () => {
    const entries = [{ id: 'a', label: 'Wash', amount: 50, frequency: 'weekly' as const }];
    const n = normalizeExpenses(makeExpenses({ other: 75, otherExpenses: entries }));
    expect(n.otherExpenses).toEqual(entries);
  });
});

describe('calcOwnerOpSummary with otherExpenses', () => {
  it('sums multiple entries with weekly/monthly conversion', () => {
    const e = makeExpenses({
      adminFee: 50,
      otherExpenses: [
        { id: 'a', label: 'Wash', amount: 50, frequency: 'weekly' },
        { id: 'b', label: 'Parts', amount: 433, frequency: 'monthly' }, // → 100/wk
      ],
    });
    expect(calcOwnerOpSummary([], e).totalExpenses).toBeCloseTo(200); // 50 + 50 + 100
  });

  it('counts legacy other exactly once via normalization', () => {
    const e = makeExpenses({ other: 60, otherFrequency: 'weekly' });
    expect(calcOwnerOpSummary([], e).totalExpenses).toBeCloseTo(60);
  });

  it('empty list adds nothing', () => {
    expect(calcOwnerOpSummary([], makeExpenses({ otherExpenses: [] })).totalExpenses).toBe(0);
  });
});
