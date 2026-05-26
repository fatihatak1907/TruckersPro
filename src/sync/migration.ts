import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncEngine } from './syncEngine';
import { pullFromSupabase } from '../storage/storage';
import { SYNC_MIGRATED_KEY } from './types';
import type { LoadEntry, FuelEntry, WeeklyExpenses } from '../types';

async function hasLocalData(): Promise<boolean> {
  const all = await AsyncStorage.getAllKeys();
  return all.some((k) =>
    k.startsWith('loads:') ||
    k.startsWith('expenses:') ||
    k.startsWith('fuel:') ||
    k.startsWith('profile:')
  );
}

async function enqueueAllLocal(): Promise<void> {
  const all = await AsyncStorage.getAllKeys();

  for (const k of all) {
    if (k.startsWith('loads:')) {
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const loads: LoadEntry[] = JSON.parse(raw);
      for (const load of loads) {
        await syncEngine.enqueue({ kind: 'upsertLoad', payload: load });
      }
    } else if (k.startsWith('fuel:')) {
      const [, driverType] = k.split(':');
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const entries: FuelEntry[] = JSON.parse(raw);
      for (const entry of entries) {
        await syncEngine.enqueue({
          kind: 'upsertFuel',
          payload: { ...entry, driverType },
        });
      }
    } else if (k.startsWith('expenses:')) {
      const [, driverType] = k.split(':');
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const expenses: WeeklyExpenses = JSON.parse(raw);
      await syncEngine.enqueue({
        kind: 'upsertExpenses',
        payload: { ...expenses, driverType },
      });
    } else if (k.startsWith('profile:')) {
      const [, driverType] = k.split(':');
      const name = await AsyncStorage.getItem(k);
      if (name == null) continue;
      await syncEngine.enqueue({
        kind: 'upsertProfile',
        payload: { driverType, name },
      });
    }
  }
}

export async function runMigrationAndPull(userId: string): Promise<void> {
  const migrated = (await AsyncStorage.getItem(SYNC_MIGRATED_KEY)) === 'true';

  // Path A: local data + not yet migrated -> upload first
  if (!migrated && (await hasLocalData())) {
    await enqueueAllLocal();
    await syncEngine.flush();
  }

  // Path B: always pull after (covers fresh device AND merges other-device data)
  await pullFromSupabase(userId);
  await AsyncStorage.setItem(SYNC_MIGRATED_KEY, 'true');
}
