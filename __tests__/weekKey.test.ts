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

import { addWeeks } from '../src/utils/weekKey';

describe('addWeeks', () => {
  it('goes back one week', () => {
    expect(addWeeks('2026-07-13', -1)).toBe('2026-07-06');
  });
  it('goes forward one week across a month boundary', () => {
    expect(addWeeks('2026-06-29', 1)).toBe('2026-07-06');
  });
});
