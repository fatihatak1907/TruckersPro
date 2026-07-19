import React, { createContext, useContext, useEffect, useState } from 'react';
import { getCurrentWeekKey } from '../utils/weekKey';
import {
  defaultSchedule,
  firstPeriod,
  getPeriod,
  addPeriods,
  periodForDate,
} from '../utils/payPeriods';
import { getSchedule } from '../storage/storage';
import type { PaySchedule, PayPeriod } from '../types';

// Kept for History fallbacks and any legacy call site (period-aware formatting
// comes from payPeriods.formatPeriodDisplay via the context's `period`).
export function formatWeekDisplay(weekKey: string): string {
  const mon = new Date(weekKey + 'T00:00:00Z');
  const sun = new Date(weekKey + 'T00:00:00Z');
  sun.setUTCDate(sun.getUTCDate() + 6);
  const f = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${f(mon)} – ${f(sun)}`;
}

type WeekContextType = {
  weekKey: string;
  period: PayPeriod;
  schedule: PaySchedule;
  scheduleLoaded: boolean;
  needsSetup: boolean;
  reloadSchedule: () => Promise<void>;
  canGoPrev: boolean;
  canGoNext: boolean;
  goToPrev: () => void;
  goToNext: () => void;
};

const BOOT_SCHEDULE = defaultSchedule();

const WeekContext = createContext<WeekContextType>({
  weekKey: getCurrentWeekKey(),
  period: getPeriod(getCurrentWeekKey(), BOOT_SCHEDULE),
  schedule: BOOT_SCHEDULE,
  scheduleLoaded: false,
  needsSetup: false,
  reloadSchedule: async () => {},
  canGoPrev: false,
  canGoNext: true,
  goToPrev: () => {},
  goToNext: () => {},
});

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Period the dashboard opens on: today's period, clamped up to the first period
 *  when startDate lies in the future. */
function homeKey(schedule: PaySchedule): string {
  const current = periodForDate(todayIso(), schedule).key;
  const floor = firstPeriod(schedule).key;
  return current < floor ? floor : current;
}

export function WeekProvider({ children }: { children: React.ReactNode }) {
  const [schedule, setSchedule] = useState<PaySchedule>(() => defaultSchedule());
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [weekKey, setWeekKey] = useState<string>(() => getCurrentWeekKey());

  async function reloadSchedule(): Promise<void> {
    const stored = await getSchedule();
    const next = stored ?? defaultSchedule();
    setSchedule(next);
    setNeedsSetup(!stored);
    setScheduleLoaded(true);
    setWeekKey(homeKey(next));
  }

  useEffect(() => {
    reloadSchedule();
  }, []);

  const floorKey = firstPeriod(schedule).key;
  const ceilKey = addPeriods(homeKey(schedule), 1, schedule);
  const canGoPrev = weekKey > floorKey;
  const canGoNext = weekKey < ceilKey;

  return (
    <WeekContext.Provider
      value={{
        weekKey,
        period: getPeriod(weekKey, schedule),
        schedule,
        scheduleLoaded,
        needsSetup,
        reloadSchedule,
        canGoPrev,
        canGoNext,
        goToPrev: () => setWeekKey((k) => (canGoPrev ? addPeriods(k, -1, schedule) : k)),
        goToNext: () => setWeekKey((k) => (canGoNext ? addPeriods(k, 1, schedule) : k)),
      }}
    >
      {children}
    </WeekContext.Provider>
  );
}

export function useWeek() {
  return useContext(WeekContext);
}
