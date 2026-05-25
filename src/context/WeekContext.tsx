import React, { createContext, useContext, useState } from 'react';
import { getCurrentWeekKey } from '../utils/weekKey';

function addWeeks(weekKey: string, delta: number): string {
  const d = new Date(weekKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

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
  goToPrev: () => void;
  goToNext: () => void;
};

const WeekContext = createContext<WeekContextType>({
  weekKey: getCurrentWeekKey(),
  goToPrev: () => {},
  goToNext: () => {},
});

export function WeekProvider({ children }: { children: React.ReactNode }) {
  const [weekKey, setWeekKey] = useState(getCurrentWeekKey());
  return (
    <WeekContext.Provider
      value={{
        weekKey,
        goToPrev: () => setWeekKey((k) => addWeeks(k, -1)),
        goToNext: () => setWeekKey((k) => addWeeks(k, 1)),
      }}
    >
      {children}
    </WeekContext.Provider>
  );
}

export function useWeek() {
  return useContext(WeekContext);
}
