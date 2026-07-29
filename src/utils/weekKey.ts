export function getWeekKey(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function getCurrentWeekKey(): string {
  // Anchor "now" to the device's LOCAL calendar day before the UTC week math:
  // for US drivers, plain new Date() would roll to the next week at 4–7pm
  // local every Sunday (midnight UTC), putting evening entries in next week.
  const now = new Date();
  return getWeekKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addWeeks(weekKey: string, delta: number): string {
  const d = new Date(weekKey + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

export function clampWeek(candidate: string, homeWeek: string): string {
  const max = addWeeks(homeWeek, 1);
  if (candidate < homeWeek) return homeWeek;
  if (candidate > max) return max;
  return candidate;
}
