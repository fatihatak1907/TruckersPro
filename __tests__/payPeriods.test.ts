import { getWeekKey } from '../src/utils/weekKey';
import {
  defaultSchedule,
  periodForDate,
  getPeriod,
  addPeriods,
  firstPeriod,
  periodDays,
  periodCalcOpts,
  formatPeriodDisplay,
  formatPayDate,
  todayKey,
} from '../src/utils/payPeriods';
import type { PaySchedule } from '../src/types';

// Weekday facts used below (all verifiable): 2026-01-01 = Thursday,
// 2026-07-13 = Monday, 2026-07-17 = Friday, 2028-01-01 = Saturday, 2028 is a leap year.

const weekly: PaySchedule = { startDate: '2026-07-13', frequency: 'weekly', payDay: 5 };
const biweekly: PaySchedule = { startDate: '2026-07-15', frequency: 'biweekly', payDay: 5 };
const monthly: PaySchedule = { startDate: '2026-07-01', frequency: 'monthly', payDay: 15 };

const addDaysIso = (key: string, n: number) => {
  const d = new Date(key + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

describe('todayKey', () => {
  it('formats the device-local date as YYYY-MM-DD', () => {
    // Noon local avoids any UTC/local ambiguity in the expectation.
    expect(todayKey(new Date(2026, 6, 19, 12, 0, 0))).toBe('2026-07-19');
  });

  it('pads single-digit month and day', () => {
    expect(todayKey(new Date(2027, 0, 5, 12, 0, 0))).toBe('2027-01-05');
  });

  it('uses the local calendar day, not the UTC one', () => {
    // 23:30 local on Jan 5: in any timezone west of UTC this is already
    // Jan 6 UTC, but the key must still say Jan 5.
    expect(todayKey(new Date(2027, 0, 5, 23, 30, 0))).toBe('2027-01-05');
  });
});

describe('defaultSchedule', () => {
  it('is weekly, payDay Friday, starting today (never a past date)', () => {
    const today = new Date(2026, 6, 17, 12, 0, 0); // Friday, local noon
    expect(defaultSchedule(today)).toEqual({
      startDate: '2026-07-17',
      frequency: 'weekly',
      payDay: 5,
    });
  });
});

describe('weekly periods', () => {
  it('produces keys byte-identical to getWeekKey across 200 consecutive dates', () => {
    for (let i = 0; i < 200; i++) {
      const iso = addDaysIso('2026-01-01', i);
      expect(periodForDate(iso, weekly).key).toBe(getWeekKey(new Date(iso + 'T00:00:00Z')));
    }
  });

  it('spans Monday–Sunday inclusive', () => {
    const p = periodForDate('2026-07-17', weekly);
    expect(p).toMatchObject({ key: '2026-07-13', start: '2026-07-13', end: '2026-07-19' });
    expect(periodDays(p)).toBe(7);
  });

  it('pay date is the first payDay weekday strictly after the end', () => {
    // end Sun 2026-07-19 → first Friday after = 2026-07-24
    expect(periodForDate('2026-07-13', weekly).payDate).toBe('2026-07-24');
  });

  it('payDay 1 (Monday) lands on the day right after a Sunday end', () => {
    const monPay: PaySchedule = { ...weekly, payDay: 1 };
    expect(periodForDate('2026-07-13', monPay).payDate).toBe('2026-07-20');
  });

  it('payDay 7 (Sunday) is strictly after the end, never the end itself', () => {
    const sunPay: PaySchedule = { ...weekly, payDay: 7 };
    // end Sun 2026-07-19 → NEXT Sunday 2026-07-26
    expect(periodForDate('2026-07-13', sunPay).payDate).toBe('2026-07-26');
  });

  it('crosses the Dec→Jan boundary', () => {
    // 2026-01-01 is a Thursday → week is 2025-12-29..2026-01-04; first Fri after = 2026-01-09
    const p = periodForDate('2026-01-01', weekly);
    expect(p).toMatchObject({ key: '2025-12-29', start: '2025-12-29', end: '2026-01-04' });
    expect(p.payDate).toBe('2026-01-09');
  });

  it('addPeriods steps by 7 days', () => {
    expect(addPeriods('2026-07-13', 1, weekly)).toBe('2026-07-20');
    expect(addPeriods('2026-07-13', -2, weekly)).toBe('2026-06-29');
  });
});

describe('biweekly periods', () => {
  it('anchors to the Monday of the week containing startDate, for all 7 start weekdays', () => {
    for (let i = 0; i < 7; i++) {
      const startDate = addDaysIso('2026-07-13', i); // Mon..Sun of the same week
      const s: PaySchedule = { startDate, frequency: 'biweekly', payDay: 5 };
      expect(firstPeriod(s).key).toBe('2026-07-13');
      expect(firstPeriod(s).end).toBe('2026-07-26');
    }
    // one week later, the anchor moves with it
    const s2: PaySchedule = { startDate: '2026-07-12', frequency: 'biweekly', payDay: 5 };
    expect(firstPeriod(s2).key).toBe('2026-07-06');
  });

  it('period is 14 days, Monday–Sunday ×2', () => {
    const p = periodForDate('2026-07-20', biweekly); // 2nd week of the first period
    expect(p).toMatchObject({ key: '2026-07-13', start: '2026-07-13', end: '2026-07-26' });
    expect(periodDays(p)).toBe(14);
  });

  it('matches the spec preview example: Jul 13 – Jul 26 pays Fri, Jul 31', () => {
    const p = firstPeriod(biweekly);
    expect(p.payDate).toBe('2026-07-31');
    expect(formatPeriodDisplay(p)).toBe('Jul 13 – Jul 26');
    expect(formatPayDate(p)).toBe('Fri, Jul 31');
  });

  it('extends the lattice backward for dates before startDate', () => {
    // day before the anchor week → previous 14-day period 2026-06-29..2026-07-12
    const p = periodForDate('2026-07-12', biweekly);
    expect(p).toMatchObject({ key: '2026-06-29', start: '2026-06-29', end: '2026-07-12' });
  });

  it('addPeriods and periodForDate agree on the lattice before AND after startDate (round-trips)', () => {
    for (let delta = -5; delta <= 5; delta++) {
      const key = addPeriods('2026-07-13', delta, biweekly);
      // key is a period start on the lattice
      expect(periodForDate(key, biweekly).key).toBe(key);
      // any date inside that period maps back to it
      expect(periodForDate(addDaysIso(key, 13), biweekly).key).toBe(key);
      // stepping back returns to the origin
      expect(addPeriods(key, -delta, biweekly)).toBe('2026-07-13');
    }
  });

  it('addPeriods normalizes an off-lattice key to its containing period first', () => {
    // 2026-07-20 is a weekly Monday inside the 2026-07-13 biweekly period
    expect(addPeriods('2026-07-20', 1, biweekly)).toBe('2026-07-27');
  });

  it('crosses Dec→Jan', () => {
    const s: PaySchedule = { startDate: '2025-12-29', frequency: 'biweekly', payDay: 5 };
    const p = firstPeriod(s);
    expect(p).toMatchObject({ key: '2025-12-29', end: '2026-01-11' });
    expect(p.payDate).toBe('2026-01-16');
  });
});

describe('monthly periods', () => {
  it('spans the true calendar month', () => {
    const p = periodForDate('2026-07-17', monthly);
    expect(p).toMatchObject({ key: '2026-07-01', start: '2026-07-01', end: '2026-07-31' });
    expect(periodDays(p)).toBe(31);
  });

  it('handles February and leap years (Feb 2028 has 29 days)', () => {
    expect(periodForDate('2026-02-10', monthly).end).toBe('2026-02-28');
    const leap = periodForDate('2028-02-10', monthly);
    expect(leap.end).toBe('2028-02-29');
    expect(periodDays(leap)).toBe(29);
  });

  it('pay date is payDay of the FOLLOWING month', () => {
    expect(periodForDate('2026-07-17', monthly).payDate).toBe('2026-08-15');
  });

  it('payDay 31 always clamps to the last day of the following month', () => {
    const last: PaySchedule = { ...monthly, payDay: 31 };
    expect(periodForDate('2026-03-10', last).payDate).toBe('2026-04-30'); // 30-day month
    expect(periodForDate('2026-01-10', last).payDate).toBe('2026-02-28'); // Feb, non-leap
    expect(periodForDate('2028-01-10', last).payDate).toBe('2028-02-29'); // Feb, leap
    expect(periodForDate('2026-07-10', last).payDate).toBe('2026-08-31'); // 31-day month
  });

  it('payDay 28 fits every month unclamped', () => {
    const d28: PaySchedule = { ...monthly, payDay: 28 };
    expect(periodForDate('2026-01-10', d28).payDate).toBe('2026-02-28');
  });

  it('crosses Dec→Jan for both period and pay date', () => {
    const p = periodForDate('2026-12-15', monthly);
    expect(p).toMatchObject({ key: '2026-12-01', end: '2026-12-31' });
    expect(p.payDate).toBe('2027-01-15');
  });

  it('addPeriods steps whole months without day clamping issues', () => {
    expect(addPeriods('2026-01-01', 1, monthly)).toBe('2026-02-01');
    expect(addPeriods('2026-01-01', -1, monthly)).toBe('2025-12-01');
    expect(addPeriods('2026-01-01', 13, monthly)).toBe('2027-02-01');
  });
});

describe('getPeriod / firstPeriod / periodCalcOpts', () => {
  it('getPeriod(key) equals periodForDate(key) — off-lattice keys resolve to their container', () => {
    expect(getPeriod('2026-07-20', biweekly)).toEqual(periodForDate('2026-07-20', biweekly));
    expect(getPeriod('2026-07-13', weekly).key).toBe('2026-07-13');
  });

  it('firstPeriod contains startDate (navigation floor), including a future startDate', () => {
    const future: PaySchedule = { startDate: '2026-08-05', frequency: 'weekly', payDay: 5 };
    expect(firstPeriod(future).key).toBe('2026-08-03');
  });

  it('periodCalcOpts flags true months and reports inclusive day counts', () => {
    expect(periodCalcOpts(firstPeriod(weekly), weekly)).toEqual({ days: 7, isMonth: false });
    expect(periodCalcOpts(firstPeriod(biweekly), biweekly)).toEqual({ days: 14, isMonth: false });
    expect(periodCalcOpts(periodForDate('2028-02-10', monthly), monthly)).toEqual({ days: 29, isMonth: true });
  });
});
