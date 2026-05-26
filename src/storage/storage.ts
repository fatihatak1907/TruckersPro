import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../types';

function loadsKey(driverType: string, weekKey: string) {
  return `loads:${driverType}:${weekKey}`;
}
function expensesKey(driverType: string, weekKey: string) {
  return `expenses:${driverType}:${weekKey}`;
}
function fuelKey(driverType: string, weekKey: string) {
  return `fuel:${driverType}:${weekKey}`;
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

export async function saveWeeklyExpenses(driverType: string, expenses: WeeklyExpenses): Promise<void> {
  await AsyncStorage.setItem(expensesKey(driverType, expenses.weekKey), JSON.stringify(expenses));
}

export async function getWeeklyExpenses(driverType: string, weekKey: string): Promise<WeeklyExpenses | null> {
  const raw = await AsyncStorage.getItem(expensesKey(driverType, weekKey));
  return raw ? JSON.parse(raw) : null;
}

export async function saveFuelEntry(driverType: string, entry: FuelEntry): Promise<void> {
  const existing = await getFuelEntriesForWeek(driverType, entry.weekKey);
  const updated = [...existing.filter((e) => e.id !== entry.id), entry];
  await AsyncStorage.setItem(fuelKey(driverType, entry.weekKey), JSON.stringify(updated));
}

export async function getFuelEntriesForWeek(driverType: string, weekKey: string): Promise<FuelEntry[]> {
  const raw = await AsyncStorage.getItem(fuelKey(driverType, weekKey));
  return raw ? JSON.parse(raw) : [];
}

export async function deleteFuelEntry(driverType: string, weekKey: string, entryId: string): Promise<void> {
  const existing = await getFuelEntriesForWeek(driverType, weekKey);
  const updated = existing.filter((e) => e.id !== entryId);
  await AsyncStorage.setItem(fuelKey(driverType, weekKey), JSON.stringify(updated));
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

export async function saveProfileName(driverType: string, name: string): Promise<void> {
  await AsyncStorage.setItem(`profile:${driverType}:name`, name);
}

export async function getProfileName(driverType: string): Promise<string> {
  return (await AsyncStorage.getItem(`profile:${driverType}:name`)) ?? '';
}
