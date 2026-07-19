import { getWeekKey } from './weekKey';
import type { PaySchedule, PayPeriod } from '../types';

const DAY_MS = 86_400_000;

function toUTC(key: string): Date {
  return new Date(key + 'T00:00:00Z');
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(key: string, n: number): string {
  const d = toUTC(key);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** ISO weekday 1=Mon … 7=Sun for a YYYY-MM-DD key (UTC). */
function isoDow(key: string): number {
  const day = toUTC(key).getUTCDay(); // 0=Sun … 6=Sat
  return day === 0 ? 7 : day;
}

/** Last day number (28–31) of the month at the given UTC year/monthIndex. */
function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Default for existing users and anyone who skips setup: weekly, paid Friday. */
export function defaultSchedule(today: Date = new Date()): PaySchedule {
  return { startDate: getWeekKey(today), frequency: 'weekly', payDay: 5 };
}

/** Monday of the week containing schedule.startDate — the biweekly lattice anchor. */
function biweeklyAnchor(schedule: PaySchedule): string {
  return getWeekKey(toUTC(schedule.startDate));
}

/** Start key of the period containing `date` (works for dates before the anchor too). */
function periodStartForDate(date: string, schedule: PaySchedule): string {
  switch (schedule.frequency) {
    case 'weekly':
      return getWeekKey(toUTC(date));
    case 'biweekly': {
      const anchor = biweeklyAnchor(schedule);
      const monday = getWeekKey(toUTC(date));
      const diffDays = Math.round((toUTC(monday).getTime() - toUTC(anchor).getTime()) / DAY_MS);
      const steps = Math.floor(diffDays / 14); // floor is negative-safe: extends lattice backward
      return addDays(anchor, steps * 14);
    }
    case 'monthly':
      return date.slice(0, 8) + '01';
  }
}

function payDateFor(start: string, end: string, schedule: PaySchedule): string {
  if (schedule.frequency === 'monthly') {
    const s = toUTC(start);
    const next = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
    const last = lastDayOfMonth(next.getUTCFullYear(), next.getUTCMonth());
    const day = schedule.payDay >= 31 ? last : Math.min(schedule.payDay, last);
    return iso(new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), day)));
  }
  // weekly / biweekly: first payDay weekday strictly AFTER the period's end.
  const candidate = addDays(end, 1);
  const shift = (schedule.payDay - isoDow(candidate) + 7) % 7;
  return addDays(candidate, shift);
}

/** Full period record for a key. Off-lattice keys resolve to their containing period. */
export function getPeriod(key: string, schedule: PaySchedule): PayPeriod {
  const start = periodStartForDate(key, schedule);
  let end: string;
  switch (schedule.frequency) {
    case 'weekly':
      end = addDays(start, 6);
      break;
    case 'biweekly':
      end = addDays(start, 13);
      break;
    case 'monthly': {
      const s = toUTC(start);
      end = iso(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0)));
      break;
    }
  }
  return { key: start, start, end, payDate: payDateFor(start, end, schedule) };
}

/** The period containing `date`. */
export function periodForDate(date: string, schedule: PaySchedule): PayPeriod {
  return getPeriod(date, schedule);
}

/** Step period keys by `delta` periods (normalizes `key` to its period start first). */
export function addPeriods(key: string, delta: number, schedule: PaySchedule): string {
  const start = periodStartForDate(key, schedule);
  switch (schedule.frequency) {
    case 'weekly':
      return addDays(start, delta * 7);
    case 'biweekly':
      return addDays(start, delta * 14);
    case 'monthly': {
      const d = toUTC(start); // always the 1st — setUTCMonth needs no day clamping
      d.setUTCMonth(d.getUTCMonth() + delta);
      return iso(d);
    }
  }
}

/** The period containing schedule.startDate — the navigation floor. */
export function firstPeriod(schedule: PaySchedule): PayPeriod {
  return periodForDate(schedule.startDate, schedule);
}

/** Inclusive day count of a period (7, 14, or 28–31). */
export function periodDays(period: PayPeriod): number {
  return Math.round((toUTC(period.end).getTime() - toUTC(period.start).getTime()) / DAY_MS) + 1;
}

/** Shape consumed by calcOwnerOpSummary's opts.period / buildInsight's opts.period. */
export function periodCalcOpts(
  period: PayPeriod,
  schedule: PaySchedule
): { days: number; isMonth: boolean } {
  return { days: periodDays(period), isMonth: schedule.frequency === 'monthly' };
}

const fmtShort = (key: string) =>
  toUTC(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Jul 13 – Jul 26" (en dash, same style as formatWeekDisplay). */
export function formatPeriodDisplay(period: PayPeriod): string {
  return `${fmtShort(period.start)} – ${fmtShort(period.end)}`;
}

/** "Fri, Jul 31" */
export function formatPayDate(period: PayPeriod): string {
  return toUTC(period.payDate).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
