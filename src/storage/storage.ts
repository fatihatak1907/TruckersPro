import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../types';

function loadsKey(driverType: string, weekKey: string) {
  return `loads:${driverType}:${weekKey}`;
}
function expensesKey(weekKey: string) {
  return `expenses:owner-op:${weekKey}`;
}
function fuelKey(weekKey: string) {
  return `fuel:owner-op:${weekKey}`;
}

export async function saveLoad(load: LoadEntry): Promise<void> {
  const key = loadsKey(load.driverType, load.weekKey);
  const existing = await getLoadsForWeek(load.driverType, load.weekKey);
  const updated = [...existing.filter((l) => l.id !== load.id), load];
  await AsyncStorage.setItem(key, JSON.stringify(updated));
}

export async function getLoadsForWeek(driverType: string, weekKey: string): Promise<LoadEntry[]> {
  const raw = await AsyncStorage.getItem(loadsKey(driverType, weekKey));
  return raw ? JSON.parse(raw) : [];
}

export async function deleteLoad(driverType: string, weekKey: string, loadId: string): Promise<void> {
  const existing = await getLoadsForWeek(driverType, weekKey);
  const updated = existing.filter((l) => l.id !== loadId);
  if (updated.length === 0) {
    await AsyncStorage.removeItem(loadsKey(driverType, weekKey));
  } else {
    await AsyncStorage.setItem(loadsKey(driverType, weekKey), JSON.stringify(updated));
  }
}

export async function saveWeeklyExpenses(expenses: WeeklyExpenses): Promise<void> {
  await AsyncStorage.setItem(expensesKey(expenses.weekKey), JSON.stringify(expenses));
}

export async function getWeeklyExpenses(weekKey: string): Promise<WeeklyExpenses | null> {
  const raw = await AsyncStorage.getItem(expensesKey(weekKey));
  return raw ? JSON.parse(raw) : null;
}

export async function saveFuelEntry(entry: FuelEntry): Promise<void> {
  const existing = await getFuelEntriesForWeek(entry.weekKey);
  const updated = [...existing.filter((e) => e.id !== entry.id), entry];
  await AsyncStorage.setItem(fuelKey(entry.weekKey), JSON.stringify(updated));
}

export async function getFuelEntriesForWeek(weekKey: string): Promise<FuelEntry[]> {
  const raw = await AsyncStorage.getItem(fuelKey(weekKey));
  return raw ? JSON.parse(raw) : [];
}

export async function deleteFuelEntry(weekKey: string, entryId: string): Promise<void> {
  const existing = await getFuelEntriesForWeek(weekKey);
  const updated = existing.filter((e) => e.id !== entryId);
  await AsyncStorage.setItem(fuelKey(weekKey), JSON.stringify(updated));
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

export async function deleteWeekData(driverType: string, weekKey: string): Promise<void> {
  await AsyncStorage.removeItem(loadsKey(driverType, weekKey));
}

export async function saveProfileName(name: string): Promise<void> {
  await AsyncStorage.setItem('profile:owner-op:name', name);
}

export async function getProfileName(): Promise<string> {
  return (await AsyncStorage.getItem('profile:owner-op:name')) ?? '';
}
