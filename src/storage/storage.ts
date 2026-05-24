import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoadEntry, WeeklyExpenses } from '../types';

function loadsKey(driverType: string, weekKey: string) {
  return `loads:${driverType}:${weekKey}`;
}

function expensesKey(weekKey: string) {
  return `expenses:owner-op:${weekKey}`;
}

export async function saveLoad(load: LoadEntry): Promise<void> {
  const key = loadsKey(load.driverType, load.weekKey);
  const existing = await getLoadsForWeek(load.driverType, load.weekKey);
  const updated = [...existing.filter((l) => l.id !== load.id), load];
  await AsyncStorage.setItem(key, JSON.stringify(updated));
}

export async function getLoadsForWeek(
  driverType: string,
  weekKey: string
): Promise<LoadEntry[]> {
  const raw = await AsyncStorage.getItem(loadsKey(driverType, weekKey));
  return raw ? JSON.parse(raw) : [];
}

export async function deleteLoad(
  driverType: string,
  weekKey: string,
  loadId: string
): Promise<void> {
  const existing = await getLoadsForWeek(driverType, weekKey);
  const updated = existing.filter((l) => l.id !== loadId);
  await AsyncStorage.setItem(loadsKey(driverType, weekKey), JSON.stringify(updated));
}

export async function saveWeeklyExpenses(expenses: WeeklyExpenses): Promise<void> {
  await AsyncStorage.setItem(expensesKey(expenses.weekKey), JSON.stringify(expenses));
}

export async function getWeeklyExpenses(weekKey: string): Promise<WeeklyExpenses | null> {
  const raw = await AsyncStorage.getItem(expensesKey(weekKey));
  return raw ? JSON.parse(raw) : null;
}

export async function getAllWeekKeys(driverType: string): Promise<string[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `loads:${driverType}:`;
  return allKeys
    .filter((k) => k.startsWith(prefix))
    .map((k) => k.replace(prefix, ''))
    .sort()
    .reverse();
}
