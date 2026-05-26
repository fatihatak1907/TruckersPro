import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoadEntry, WeeklyExpenses, FuelEntry } from '../types';
import { syncEngine } from '../sync/syncEngine';
import { SYNC_QUEUE_KEY, SYNC_MIGRATED_KEY } from '../sync/types';
import { supabase } from '../supabase/client';

function loadsKey(driverType: string, weekKey: string) {
  return `loads:${driverType}:${weekKey}`;
}
function expensesKey(driverType: string, weekKey: string) {
  return `expenses:${driverType}:${weekKey}`;
}
function fuelKey(driverType: string, weekKey: string) {
  return `fuel:${driverType}:${weekKey}`;
}

export async function saveLoad(loadOrDriverType: LoadEntry | string, maybeLoad?: LoadEntry): Promise<void> {
  const load: LoadEntry =
    typeof loadOrDriverType === 'string' ? (maybeLoad as LoadEntry) : loadOrDriverType;
  const key = loadsKey(load.driverType, load.weekKey);
  const existing = await getLoadsForWeek(load.driverType, load.weekKey);
  const updated = [...existing.filter((l) => l.id !== load.id), load];
  await AsyncStorage.setItem(key, JSON.stringify(updated));
  await syncEngine.enqueue({ kind: 'upsertLoad', payload: load });
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
  await syncEngine.enqueue({ kind: 'deleteLoad', payload: { id: loadId } });
}

export async function saveWeeklyExpenses(driverType: string, expenses: WeeklyExpenses): Promise<void> {
  await AsyncStorage.setItem(expensesKey(driverType, expenses.weekKey), JSON.stringify(expenses));
  await syncEngine.enqueue({ kind: 'upsertExpenses', payload: { ...expenses, driverType } });
}

export async function getWeeklyExpenses(driverType: string, weekKey: string): Promise<WeeklyExpenses | null> {
  const raw = await AsyncStorage.getItem(expensesKey(driverType, weekKey));
  return raw ? JSON.parse(raw) : null;
}

export async function saveFuelEntry(driverType: string, entry: FuelEntry): Promise<void> {
  const existing = await getFuelEntriesForWeek(driverType, entry.weekKey);
  const updated = [...existing.filter((e) => e.id !== entry.id), entry];
  await AsyncStorage.setItem(fuelKey(driverType, entry.weekKey), JSON.stringify(updated));
  await syncEngine.enqueue({ kind: 'upsertFuel', payload: { ...entry, driverType } });
}

export async function getFuelEntriesForWeek(driverType: string, weekKey: string): Promise<FuelEntry[]> {
  const raw = await AsyncStorage.getItem(fuelKey(driverType, weekKey));
  return raw ? JSON.parse(raw) : [];
}

export async function deleteFuelEntry(driverType: string, weekKey: string, entryId: string): Promise<void> {
  const existing = await getFuelEntriesForWeek(driverType, weekKey);
  const updated = existing.filter((e) => e.id !== entryId);
  await AsyncStorage.setItem(fuelKey(driverType, weekKey), JSON.stringify(updated));
  await syncEngine.enqueue({ kind: 'deleteFuel', payload: { id: entryId } });
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
  await syncEngine.enqueue({ kind: 'deleteWeek', payload: { driverType, weekKey } });
}

export async function saveProfileName(driverType: string, name: string): Promise<void> {
  await AsyncStorage.setItem(`profile:${driverType}:name`, name);
  await syncEngine.enqueue({ kind: 'upsertProfile', payload: { driverType, name } });
}

export async function getProfileName(driverType: string): Promise<string> {
  return (await AsyncStorage.getItem(`profile:${driverType}:name`)) ?? '';
}

export async function wipeAll(): Promise<void> {
  const all = await AsyncStorage.getAllKeys();
  const ours = all.filter((k) =>
    k.startsWith('loads:') ||
    k.startsWith('expenses:') ||
    k.startsWith('fuel:') ||
    k.startsWith('profile:') ||
    k === SYNC_QUEUE_KEY ||
    k === SYNC_MIGRATED_KEY
  );
  if (ours.length) await AsyncStorage.multiRemove(ours);
}

export async function pullFromSupabase(userId: string): Promise<void> {
  const [loadsRes, fuelRes, expRes, profRes] = await Promise.all([
    supabase.from('loads').select('*').eq('user_id', userId),
    supabase.from('fuel_entries').select('*').eq('user_id', userId),
    supabase.from('weekly_expenses').select('*').eq('user_id', userId),
    supabase.from('profiles').select('*').eq('user_id', userId),
  ]);
  const err = loadsRes.error ?? fuelRes.error ?? expRes.error ?? profRes.error;
  if (err) throw new Error(err.message);

  // Group loads by (driverType, weekKey)
  const loadsByKey: Record<string, LoadEntry[]> = {};
  for (const row of loadsRes.data ?? []) {
    const load: LoadEntry = {
      id: row.id,
      weekKey: row.week_key,
      driverType: row.driver_type,
      startLocation: row.start_location,
      endLocation: row.end_location,
      createdAt: row.created_at,
      earnings: row.earnings ?? undefined,
      tonu: row.tonu ?? undefined,
      commissionRate: row.commission_rate ?? undefined,
      paidMileage: row.paid_mileage ?? undefined,
      centsPerMile: row.cents_per_mile ?? undefined,
    };
    const k = `loads:${row.driver_type}:${row.week_key}`;
    (loadsByKey[k] ||= []).push(load);
  }
  for (const [k, arr] of Object.entries(loadsByKey)) {
    await AsyncStorage.setItem(k, JSON.stringify(arr));
  }

  // Group fuel by (driverType, weekKey)
  const fuelByKey: Record<string, FuelEntry[]> = {};
  for (const row of fuelRes.data ?? []) {
    const entry: FuelEntry = {
      id: row.id,
      weekKey: row.week_key,
      type: row.type,
      cost: Number(row.cost),
      createdAt: row.created_at,
    };
    const k = `fuel:${row.driver_type}:${row.week_key}`;
    (fuelByKey[k] ||= []).push(entry);
  }
  for (const [k, arr] of Object.entries(fuelByKey)) {
    await AsyncStorage.setItem(k, JSON.stringify(arr));
  }

  // Weekly expenses (one row per driverType+weekKey)
  for (const row of expRes.data ?? []) {
    const expenses: WeeklyExpenses = {
      weekKey: row.week_key,
      truckPayment: Number(row.truck_payment),
      truckPaymentFrequency: row.truck_payment_frequency,
      truckInsurance: Number(row.truck_insurance),
      trailerInsurance: Number(row.trailer_insurance),
      trailerLease: Number(row.trailer_lease),
      iftaCost: Number(row.ifta_cost),
      adminFee: Number(row.admin_fee),
      other: Number(row.other),
      startOdometer: Number(row.start_odometer),
      endOdometer: Number(row.end_odometer),
    };
    await AsyncStorage.setItem(
      `expenses:${row.driver_type}:${row.week_key}`,
      JSON.stringify(expenses)
    );
  }

  // Profiles (one row per driverType)
  for (const row of profRes.data ?? []) {
    await AsyncStorage.setItem(`profile:${row.driver_type}:name`, row.name);
  }
}
