import React, { createContext, useContext, useState } from 'react';
import { getCurrentWeekKey, addWeeks, clampWeek } from '../utils/weekKey';

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
  canGoPrev: boolean;
  canGoNext: boolean;
  goToPrev: () => void;
  goToNext: () => void;
};

const WeekContext = createContext<WeekContextType>({
  weekKey: getCurrentWeekKey(),
  canGoPrev: false,
  canGoNext: true,
  goToPrev: () => {},
  goToNext: () => {},
});

export function WeekProvider({ children }: { children: React.ReactNode }) {
  const [homeWeek] = useState(getCurrentWeekKey());
  const [weekKey, setWeekKey] = useState(homeWeek);
  return (
    <WeekContext.Provider
      value={{
        weekKey,
        canGoPrev: weekKey > homeWeek,
        canGoNext: weekKey < addWeeks(homeWeek, 1),
        goToPrev: () => setWeekKey((k) => clampWeek(addWeeks(k, -1), homeWeek)),
        goToNext: () => setWeekKey((k) => clampWeek(addWeeks(k, 1), homeWeek)),
      }}
    >
      {children}
    </WeekContext.Provider>
  );
}

export function useWeek() {
  return useContext(WeekContext);
}
