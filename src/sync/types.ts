import type { LoadEntry, FuelEntry, WeeklyExpenses } from '../types';

export type SyncOp =
  | { kind: 'upsertLoad'; payload: LoadEntry }
  | { kind: 'deleteLoad'; payload: { id: string } }
  | { kind: 'upsertFuel'; payload: FuelEntry & { driverType: string } }
  | { kind: 'deleteFuel'; payload: { id: string } }
  | { kind: 'upsertExpenses'; payload: WeeklyExpenses & { driverType: string } }
  | { kind: 'deleteWeek'; payload: { driverType: string; weekKey: string } }
  | { kind: 'upsertProfile'; payload: { driverType: string; name: string } };

export type QueuedOp = {
  id: string;
  op: SyncOp;
  attempts: number;
  lastError?: string;
  createdAt: string;
};

export const SYNC_QUEUE_KEY = 'sync:queue';
export const SYNC_MIGRATED_KEY = 'sync:migrated';
