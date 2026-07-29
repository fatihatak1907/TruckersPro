import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../supabase/client';
import { SyncOp, QueuedOp, SYNC_QUEUE_KEY, SYNC_DEAD_KEY, MAX_OP_ATTEMPTS } from './types';

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function readQueue(): Promise<QueuedOp[]> {
  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedOp[]) : [];
}

async function writeQueue(q: QueuedOp[]): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(q));
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function dispatch(op: SyncOp, userId: string): Promise<void> {
  switch (op.kind) {
    case 'upsertLoad': {
      const l = op.payload;
      const { error } = await supabase.from('loads').upsert({
        id: l.id,
        user_id: userId,
        week_key: l.weekKey,
        driver_type: l.driverType,
        start_location: l.startLocation,
        end_location: l.endLocation,
        earnings: l.earnings ?? null,
        tonu: l.tonu ?? null,
        commission_rate: l.commissionRate ?? null,
        customer_commission_rate: l.customerCommissionRate ?? null,
        paid_mileage: l.paidMileage ?? null,
        cents_per_mile: l.centsPerMile ?? null,
        extra_mileage: l.extraMileage ?? null,
        created_at: l.createdAt,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }
    case 'deleteLoad': {
      const { error } = await supabase.from('loads').delete()
        .eq('user_id', userId).eq('id', op.payload.id);
      if (error) throw new Error(error.message);
      return;
    }
    case 'upsertFuel': {
      const f = op.payload;
      const { error } = await supabase.from('fuel_entries').upsert({
        id: f.id,
        user_id: userId,
        week_key: f.weekKey,
        driver_type: f.driverType,
        type: f.type,
        cost: f.cost,
        created_at: f.createdAt,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }
    case 'deleteFuel': {
      const { error } = await supabase.from('fuel_entries').delete()
        .eq('user_id', userId).eq('id', op.payload.id);
      if (error) throw new Error(error.message);
      return;
    }
    case 'upsertExpenses': {
      const e = op.payload;
      const { error } = await supabase.from('weekly_expenses').upsert({
        user_id: userId,
        driver_type: e.driverType,
        week_key: e.weekKey,
        truck_payment: e.truckPayment,
        truck_payment_frequency: e.truckPaymentFrequency,
        truck_insurance: e.truckInsurance,
        truck_insurance_frequency: e.truckInsuranceFrequency,
        trailer_insurance: e.trailerInsurance,
        trailer_insurance_frequency: e.trailerInsuranceFrequency,
        trailer_lease: e.trailerLease,
        trailer_lease_frequency: e.trailerLeaseFrequency,
        ifta_cost: e.iftaCost,
        ifta_cost_frequency: e.iftaCostFrequency,
        toll: e.toll ?? 0,
        toll_frequency: e.tollFrequency ?? 'weekly',
        admin_fee: e.adminFee,
        admin_fee_frequency: e.adminFeeFrequency,
        other: e.other,
        other_frequency: e.otherFrequency,
        other_expenses: e.otherExpenses ?? [],
        start_odometer: e.startOdometer,
        end_odometer: e.endOdometer,
        mileage_rate: e.mileageRate ?? 0.14,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      return;
    }
    case 'deleteWeek': {
      const { driverType, weekKey } = op.payload;
      const [a, b, c] = await Promise.all([
        supabase.from('loads').delete()
          .eq('user_id', userId).eq('driver_type', driverType).eq('week_key', weekKey),
        supabase.from('fuel_entries').delete()
          .eq('user_id', userId).eq('driver_type', driverType).eq('week_key', weekKey),
        supabase.from('weekly_expenses').delete()
          .eq('user_id', userId).eq('driver_type', driverType).eq('week_key', weekKey),
      ]);
      const err = a.error ?? b.error ?? c.error;
      if (err) throw new Error(err.message);
      return;
    }
    case 'upsertPayment': {
      const p = op.payload;
      const { error } = await supabase.from('period_payments').upsert({
        user_id: userId,
        driver_type: p.driverType,
        period_key: p.periodKey,
        paid_at: p.paidAt,
      });
      if (error) throw new Error(error.message);
      return;
    }
    case 'deletePayment': {
      const { error } = await supabase.from('period_payments').delete()
        .eq('user_id', userId)
        .eq('driver_type', op.payload.driverType)
        .eq('period_key', op.payload.periodKey);
      if (error) throw new Error(error.message);
      return;
    }
    case 'upsertProfile': {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (op.payload.name !== undefined) update.name = op.payload.name;
      if (op.payload.schedule) {
        update.schedule_start_date = op.payload.schedule.startDate;
        update.schedule_frequency = op.payload.schedule.frequency;
        update.schedule_pay_day = op.payload.schedule.payDay;
      }
      const { error } = await supabase.from('profiles').update(update).eq('user_id', userId);
      if (error) throw new Error(error.message);
      return;
    }
  }
}

let flushing = false;
let inFlight: Promise<void> | null = null;
// Bumped by stop(): any flush from a previous generation must not write the
// queue back after sign-out has wiped it (would resurrect the old user's ops).
let generation = 0;

// Remove one op by id, re-reading the queue so ops enqueued mid-flush survive.
async function removeOp(id: string): Promise<void> {
  const q = await readQueue();
  await writeQueue(q.filter((x) => x.id !== id));
}

async function updateOp(op: QueuedOp): Promise<void> {
  const q = await readQueue();
  const i = q.findIndex((x) => x.id === op.id);
  if (i >= 0) {
    q[i] = op;
    await writeQueue(q);
  }
}

async function parkDeadOp(op: QueuedOp): Promise<void> {
  const raw = await AsyncStorage.getItem(SYNC_DEAD_KEY);
  const dead: QueuedOp[] = raw ? JSON.parse(raw) : [];
  dead.push(op);
  await AsyncStorage.setItem(SYNC_DEAD_KEY, JSON.stringify(dead.slice(-50)));
  await removeOp(op.id);
}

async function doFlush(): Promise<void> {
  flushing = true;
  const myGeneration = generation;
  try {
    const userId = await getUserId();
    if (!userId) return;
    // Re-read the queue every iteration: enqueue() may append while a dispatch
    // is awaiting the network, and writing a stale snapshot would erase those
    // ops permanently (local record saved, never synced).
    while (true) {
      if (generation !== myGeneration) return;
      const queue = await readQueue();
      if (queue.length === 0) return;
      const head = queue[0];
      // Op enqueued by a different account on this device: drop it. It must
      // never be uploaded under the current user's id.
      if (head.owner && head.owner !== userId) {
        if (generation !== myGeneration) return;
        await removeOp(head.id);
        continue;
      }
      try {
        await dispatch(head.op, userId);
        if (generation !== myGeneration) return;
        await removeOp(head.id);
      } catch (err: any) {
        head.attempts += 1;
        head.lastError = err?.message ?? String(err);
        if (generation !== myGeneration) return;
        if (head.attempts >= MAX_OP_ATTEMPTS) {
          // Poison pill: park it so it stops blocking every later op.
          await parkDeadOp(head);
          continue;
        }
        await updateOp(head);
        return;
      }
    }
  } finally {
    flushing = false;
    inFlight = null;
  }
}

async function flush(): Promise<void> {
  if (flushing && inFlight) return inFlight;
  inFlight = doFlush();
  return inFlight;
}

async function enqueue(op: SyncOp): Promise<void> {
  // getSession reads the locally cached session — works offline. An op with
  // no resolvable owner still syncs (legacy behavior); the owner stamp only
  // exists to stop another account's leftovers from being uploaded.
  let owner: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    owner = data.session?.user?.id;
  } catch {
    owner = undefined;
  }
  const queue = await readQueue();
  queue.push({
    id: uid(),
    op,
    attempts: 0,
    createdAt: new Date().toISOString(),
    owner,
  });
  await writeQueue(queue);
  flush().catch(() => {});
}

let netUnsub: (() => void) | null = null;
let intervalId: any = null;

async function getQueueSize(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

function start(): void {
  if (netUnsub) return; // already started
  netUnsub = NetInfo.addEventListener((state) => {
    if (state.isConnected) flush().catch(() => {});
  });
  intervalId = setInterval(() => {
    flush().catch(() => {});
  }, 30_000);
  flush().catch(() => {});
}

function stop(): void {
  generation += 1; // invalidate any in-flight flush's queue writes
  if (netUnsub) { netUnsub(); netUnsub = null; }
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

function __resetForTests() {
  flushing = false;
  inFlight = null;
  stop();
}

export const syncEngine = {
  enqueue,
  flush,
  start,
  stop,
  getQueueSize,
  __resetForTests,
};
