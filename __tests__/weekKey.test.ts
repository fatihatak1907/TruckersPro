import { getWeekKey, getCurrentWeekKey } from '../src/utils/weekKey';

describe('getWeekKey', () => {
  it('returns Monday ISO date for a Monday', () => {
    // 2026-05-25 is a Monday
    expect(getWeekKey(new Date('2026-05-25'))).toBe('2026-05-25');
  });

  it('returns the previous Monday for a Wednesday', () => {
    // 2026-05-27 is a Wednesday → Monday is 2026-05-25
    expect(getWeekKey(new Date('2026-05-27'))).toBe('2026-05-25');
  });

  it('returns the previous Monday for a Sunday', () => {
    // 2026-05-31 is a Sunday → Monday is 2026-05-25
    expect(getWeekKey(new Date('2026-05-31'))).toBe('2026-05-25');
  });
});

describe('getCurrentWeekKey', () => {
  it('returns a string in YYYY-MM-DD format', () => {
    expect(getCurrentWeekKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

import { addWeeks, clampWeek } from '../src/utils/weekKey';

describe('addWeeks', () => {
  it('goes back one week', () => {
    expect(addWeeks('2026-07-13', -1)).toBe('2026-07-06');
  });
  it('goes forward one week across a month boundary', () => {
    expect(addWeeks('2026-06-29', 1)).toBe('2026-07-06');
  });
});

describe('clampWeek', () => {
  const home = '2026-07-13';
  test('below home clamps to home', () => {
    expect(clampWeek('2026-07-06', home)).toBe(home);
  });
  test('home passes through', () => {
    expect(clampWeek(home, home)).toBe(home);
  });
  test('home+1 passes through', () => {
    expect(clampWeek('2026-07-20', home)).toBe('2026-07-20');
  });
  test('beyond home+1 clamps to home+1', () => {
    expect(clampWeek('2026-07-27', home)).toBe('2026-07-20');
  });
});
