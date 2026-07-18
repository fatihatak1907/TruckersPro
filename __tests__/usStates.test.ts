import { US_STATES, splitCityState, joinCityState } from '../src/utils/usStates';

describe('US_STATES', () => {
  test('has exactly 56 entries (50 states + DC + 5 territories)', () => {
    expect(US_STATES).toHaveLength(56);
  });
  test('codes are unique 2-letter uppercase', () => {
    const codes = US_STATES.map((s) => s.code);
    expect(new Set(codes).size).toBe(56);
    codes.forEach((c) => expect(c).toMatch(/^[A-Z]{2}$/));
  });
  test('includes DC and the five territories', () => {
    for (const c of ['DC', 'PR', 'GU', 'VI', 'AS', 'MP']) {
      expect(US_STATES.some((s) => s.code === c)).toBe(true);
    }
  });
});

describe('splitCityState', () => {
  test('City, ST splits', () => {
    expect(splitCityState('Dallas, TX')).toEqual({ city: 'Dallas', state: 'TX' });
  });
  test('territory splits', () => {
    expect(splitCityState('San Juan, PR')).toEqual({ city: 'San Juan', state: 'PR' });
  });
  test('city with internal comma keeps head as city', () => {
    expect(splitCityState('Winston, Salem, NC')).toEqual({ city: 'Winston, Salem', state: 'NC' });
  });
  test('bare code goes to city (state unselected)', () => {
    expect(splitCityState('TX')).toEqual({ city: 'TX', state: null });
  });
  test('unknown tail goes wholly to city', () => {
    expect(splitCityState('Dallas, Texas')).toEqual({ city: 'Dallas, Texas', state: null });
  });
});

describe('joinCityState', () => {
  test('joins with comma-space', () => {
    expect(joinCityState(' Dallas ', 'TX')).toBe('Dallas, TX');
  });
});
