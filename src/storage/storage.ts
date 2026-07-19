import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoadEntry, WeeklyExpenses, FuelEntry, PaySchedule } from '../types';
import { syncEngine } from '../sync/syncEngine';
import { SYNC_QUEUE_KEY, SYNC_MIGRATED_KEY } from '../sync/types';
import { supabase } from '../supabase/client';
import { normalizeExpenses } from '../utils/calculations';

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
  return raw ? normalizeExpenses(JSON.parse(raw)) : null;
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

// Payment confirmations: value is the ISO timestamp the user marked the period paid.
function paidPeriodKey(driverType: string, periodKey: string) {
  return `paid:${driverType}:${periodKey}`;
}

export async function markPeriodPaid(driverType: string, periodKey: string): Promise<void> {
  const paidAt = new Date().toISOString();
  await AsyncStorage.setItem(paidPeriodKey(driverType, periodKey), paidAt);
  await syncEngine.enqueue({ kind: 'upsertPayment', payload: { driverType, periodKey, paidAt } });
}

export async function unmarkPeriodPaid(driverType: string, periodKey: string): Promise<void> {
  await AsyncStorage.removeItem(paidPeriodKey(driverType, periodKey));
  await syncEngine.enqueue({ kind: 'deletePayment', payload: { driverType, periodKey } });
}

export async function isPeriodPaid(driverType: string, periodKey: string): Promise<boolean> {
  return (await AsyncStorage.getItem(paidPeriodKey(driverType, periodKey))) != null;
}

export async function getPaidPeriodKeys(driverType: string): Promise<Set<string>> {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `paid:${driverType}:`;
  return new Set(allKeys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)));
}

export const PROFILE_NAME_KEY = 'profile:name';
export const PROFILE_DRIVER_TYPE_KEY = 'profile:driver_type';

export async function saveProfileName(name: string): Promise<void> {
  await AsyncStorage.setItem(PROFILE_NAME_KEY, name);
  await syncEngine.enqueue({ kind: 'upsertProfile', payload: { name } });
}

export async function getProfileName(): Promise<string> {
  return (await AsyncStorage.getItem(PROFILE_NAME_KEY)) ?? '';
}

export async function saveDriverType(driverType: string): Promise<void> {
  await AsyncStorage.setItem(PROFILE_DRIVER_TYPE_KEY, driverType);
}

export async function getDriverType(): Promise<string | null> {
  return await AsyncStorage.getItem(PROFILE_DRIVER_TYPE_KEY);
}

export const PROFILE_SCHEDULE_KEY = 'profile:schedule';

// Owner of the local data. Lives under the profile: prefix ON PURPOSE: a clean
// sign-out wipes it with everything else (no mismatch possible afterwards),
// while an interrupted wipe leaves it behind together with the leftovers it
// guards — so App bootstrap can detect the account switch and purge.
const LAST_USER_ID_KEY = 'profile:last_user_id';

export async function getLastUserId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_USER_ID_KEY);
}

export async function setLastUserId(uid: string): Promise<void> {
  await AsyncStorage.setItem(LAST_USER_ID_KEY, uid);
}
export const SCHEDULE_BANNER_DISMISSED_KEY = 'profile:schedule_banner_dismissed';

export async function saveScheduleLocal(schedule: PaySchedule): Promise<void> {
  await AsyncStorage.setItem(PROFILE_SCHEDULE_KEY, JSON.stringify(schedule));
}

export async function saveSchedule(schedule: PaySchedule): Promise<void> {
  await saveScheduleLocal(schedule);
  await syncEngine.enqueue({ kind: 'upsertProfile', payload: { schedule } });
}

export async function getSchedule(): Promise<PaySchedule | null> {
  const raw = await AsyncStorage.getItem(PROFILE_SCHEDULE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaySchedule;
  } catch {
    return null;
  }
}

export async function getScheduleBannerDismissed(): Promise<boolean> {
  return (await AsyncStorage.getItem(SCHEDULE_BANNER_DISMISSED_KEY)) === 'true';
}

export async function setScheduleBannerDismissed(): Promise<void> {
  await AsyncStorage.setItem(SCHEDULE_BANNER_DISMISSED_KEY, 'true');
}

export async function wipeAll(): Promise<void> {
  const all = await AsyncStorage.getAllKeys();
  const ours = all.filter((k) =>
    k.startsWith('loads:') ||
    k.startsWith('expenses:') ||
    k.startsWith('fuel:') ||
    k.startsWith('paid:') ||
    k.startsWith('profile:') ||
    k === SYNC_QUEUE_KEY ||
    k === SYNC_MIGRATED_KEY
  );
  if (ours.length) await AsyncStorage.multiRemove(ours);
}

export async function pullFromSupabase(userId: string): Promise<void> {
  const [loadsRes, fuelRes, expRes, profRes, payRes] = await Promise.all([
    supabase.from('loads').select('*').eq('user_id', userId),
    supabase.from('fuel_entries').select('*').eq('user_id', userId),
    supabase.from('weekly_expenses').select('*').eq('user_id', userId),
    supabase.from('profiles').select('*').eq('user_id', userId),
    supabase.from('period_payments').select('*').eq('user_id', userId),
  ]);
  const err = loadsRes.error ?? fuelRes.error ?? expRes.error ?? profRes.error ?? payRes.error;
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
      extraMileage: row.extra_mileage != null ? Number(row.extra_mileage) : undefined,
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
      truckInsuranceFrequency: row.truck_insurance_frequency ?? 'weekly',
      trailerInsurance: Number(row.trailer_insurance),
      trailerInsuranceFrequency: row.trailer_insurance_frequency ?? 'weekly',
      trailerLease: Number(row.trailer_lease),
      trailerLeaseFrequency: row.trailer_lease_frequency ?? 'weekly',
      iftaCost: Number(row.ifta_cost),
      iftaCostFrequency: row.ifta_cost_frequency ?? 'weekly',
      toll: row.toll != null ? Number(row.toll) : 0,
      tollFrequency: row.toll_frequency ?? 'weekly',
      adminFee: Number(row.admin_fee),
      adminFeeFrequency: row.admin_fee_frequency ?? 'weekly',
      other: Number(row.other),
      otherFrequency: row.other_frequency ?? 'weekly',
      otherExpenses: row.other_expenses ?? [],
      startOdometer: Number(row.start_odometer),
      endOdometer: Number(row.end_odometer),
      mileageRate: row.mileage_rate != null ? Number(row.mileage_rate) : 0.14,
    };
    await AsyncStorage.setItem(
      `expenses:${row.driver_type}:${row.week_key}`,
      JSON.stringify(expenses)
    );
  }

  // Payment confirmations (one row per paid period)
  for (const row of payRes.data ?? []) {
    await AsyncStorage.setItem(
      paidPeriodKey(row.driver_type, row.period_key),
      row.paid_at ?? new Date().toISOString()
    );
  }

  // Profiles (single row per user with driver_type + name + pay schedule)
  for (const row of profRes.data ?? []) {
    await AsyncStorage.setItem(PROFILE_NAME_KEY, row.name ?? '');
    await AsyncStorage.setItem(PROFILE_DRIVER_TYPE_KEY, row.driver_type);
    if (row.schedule_start_date) {
      const schedule: PaySchedule = {
        startDate: String(row.schedule_start_date).slice(0, 10),
        frequency: row.schedule_frequency ?? 'weekly',
        payDay: row.schedule_pay_day != null ? Number(row.schedule_pay_day) : 5,
      };
      await saveScheduleLocal(schedule);
    }
  }
}
