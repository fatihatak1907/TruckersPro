import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveLoad,
  getLoadsForWeek,
  deleteLoad,
  saveWeeklyExpenses,
  getWeeklyExpenses,
  getAllWeekKeys,
  saveSchedule,
  saveScheduleLocal,
  getSchedule,
  getLastUserId,
  setLastUserId,
  markPeriodPaid,
  unmarkPeriodPaid,
  isPeriodPaid,
  getPaidPeriodKeys,
  wipeAll,
} from '../src/storage/storage';
import type { LoadEntry, WeeklyExpenses } from '../src/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

const sampleLoad: LoadEntry = {
  id: 'test-1',
  weekKey: '2026-05-25',
  driverType: 'owner-op',
  startLocation: 'TX',
  endLocation: 'CA',
  createdAt: '2026-05-25T10:00:00Z',
  earnings: 2500,
  commissionRate: 0.10,
};

describe('saveLoad / getLoadsForWeek', () => {
  it('saves and retrieves a load', async () => {
    await saveLoad(sampleLoad);
    const loads = await getLoadsForWeek('owner-op', '2026-05-25');
    expect(loads).toHaveLength(1);
    expect(loads[0].id).toBe('test-1');
  });

  it('returns empty array for unknown week', async () => {
    const loads = await getLoadsForWeek('owner-op', '2026-01-01');
    expect(loads).toHaveLength(0);
  });
});

describe('deleteLoad', () => {
  it('removes a load by id', async () => {
    await saveLoad(sampleLoad);
    await deleteLoad('owner-op', '2026-05-25', 'test-1');
    const loads = await getLoadsForWeek('owner-op', '2026-05-25');
    expect(loads).toHaveLength(0);
  });
});

describe('saveWeeklyExpenses / getWeeklyExpenses', () => {
  const expenses: WeeklyExpenses = {
    weekKey: '2026-05-25',
    truckPayment: 600, truckPaymentFrequency: 'weekly',
    truckInsurance: 250, truckInsuranceFrequency: 'weekly',
    trailerInsurance: 80, trailerInsuranceFrequency: 'weekly',
    trailerLease: 200, trailerLeaseFrequency: 'weekly',
    iftaCost: 50, iftaCostFrequency: 'weekly',
    adminFee: 40, adminFeeFrequency: 'weekly',
    other: 0, otherFrequency: 'weekly',
    startOdometer: 100000, endOdometer: 103500,
  };

  it('saves and retrieves weekly expenses', async () => {
    await saveWeeklyExpenses('owner-op', expenses);
    const result = await getWeeklyExpenses('owner-op', '2026-05-25');
    expect(result?.truckPayment).toBe(600);
  });

  it('returns null for unknown week', async () => {
    const result = await getWeeklyExpenses('owner-op', '2025-01-01');
    expect(result).toBeNull();
  });
});

describe('getAllWeekKeys', () => {
  it('returns distinct week keys for a driver type', async () => {
    await saveLoad({ ...sampleLoad, id: 'a', weekKey: '2026-05-25' });
    await saveLoad({ ...sampleLoad, id: 'b', weekKey: '2026-05-18' });
    const keys = await getAllWeekKeys('owner-op');
    expect(keys).toContain('2026-05-25');
    expect(keys).toContain('2026-05-18');
    expect(keys).toHaveLength(2);
  });
});

import { syncEngine } from '../src/sync/syncEngine';
import { SYNC_QUEUE_KEY } from '../src/sync/types';

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: false })),
}));
jest.mock('../src/supabase/client', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null } })) },
    from: jest.fn(),
  },
}));

describe('storage enqueues sync ops', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    syncEngine.__resetForTests();
  });

  test('saveLoad enqueues an upsertLoad op', async () => {
    const { saveLoad } = require('../src/storage/storage');
    await saveLoad('owner-op', {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
      earnings: 100,
    });
    const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
    expect(queue.length).toBeGreaterThanOrEqual(1);
    expect(queue[0].op).toMatchObject({ kind: 'upsertLoad', payload: { id: 'load-1' } });
  });

  test('deleteLoad enqueues a deleteLoad op', async () => {
    const { saveLoad, deleteLoad } = require('../src/storage/storage');
    await saveLoad('owner-op', {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
    });
    await deleteLoad('owner-op', '2026-05-25', 'load-1');
    const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
    const last = queue[queue.length - 1];
    expect(last.op.kind).toBe('deleteLoad');
    expect(last.op.payload.id).toBe('load-1');
  });
});

describe('profile API v2 (no driverType arg)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('saveProfileName / getProfileName round-trip without driverType arg', async () => {
    const { saveProfileName, getProfileName } = require('../src/storage/storage');
    await saveProfileName('Fatih');
    const got = await getProfileName();
    expect(got).toBe('Fatih');
  });

  test('saveDriverType / getDriverType round-trip', async () => {
    const { saveDriverType, getDriverType } = require('../src/storage/storage');
    await saveDriverType('owner-op');
    const got = await getDriverType();
    expect(got).toBe('owner-op');
  });

  test('getDriverType returns null when unset', async () => {
    const { getDriverType } = require('../src/storage/storage');
    const got = await getDriverType();
    expect(got).toBeNull();
  });
});

describe('pay schedule storage', () => {
  const schedule = { startDate: '2026-07-15', frequency: 'biweekly' as const, payDay: 5 };

  it('getSchedule returns null when nothing stored', async () => {
    expect(await getSchedule()).toBeNull();
  });

  it('saveSchedule persists locally and enqueues an upsertProfile op with the schedule', async () => {
    await saveSchedule(schedule);
    expect(await getSchedule()).toEqual(schedule);
    const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
    const op = queue[queue.length - 1].op;
    expect(op.kind).toBe('upsertProfile');
    expect(op.payload.schedule).toEqual(schedule);
  });

  it('saveScheduleLocal writes locally without enqueueing', async () => {
    await saveScheduleLocal(schedule);
    expect(await getSchedule()).toEqual(schedule);
    expect(await AsyncStorage.getItem(SYNC_QUEUE_KEY)).toBeNull();
  });
});

describe('ensureExpensesForPeriod (recurring carry-forward)', () => {
  const src: any = {
    weekKey: '2026-07-13',
    truckPayment: 600, truckPaymentFrequency: 'weekly',
    truckInsurance: 250, truckInsuranceFrequency: 'monthly',
    trailerInsurance: 80, trailerInsuranceFrequency: 'weekly',
    trailerLease: 200, trailerLeaseFrequency: 'biweekly',
    iftaCost: 50, iftaCostFrequency: 'weekly',
    toll: 40, tollFrequency: 'weekly',
    adminFee: 30, adminFeeFrequency: 'weekly',
    other: 0, otherFrequency: 'weekly',
    otherExpenses: [
      { id: 'a', label: 'Truck wash', amount: 25, frequency: 'weekly' },
      { id: 'b', label: 'Repair', amount: 300, frequency: 'once' },
    ],
    startOdometer: 100000, endOdometer: 103500,
    mileageRate: 0.2,
  };

  it('copies recurring values into an empty later period, resets odometers, drops once-only extras', async () => {
    const { ensureExpensesForPeriod, saveWeeklyExpenses, getWeeklyExpenses } = require('../src/storage/storage');
    await saveWeeklyExpenses('owner-op', src);
    const carried = await ensureExpensesForPeriod('owner-op', '2026-07-20');
    expect(carried).not.toBeNull();
    expect(carried!.truckPayment).toBe(600);
    expect(carried!.truckInsuranceFrequency).toBe('monthly');
    expect(carried!.trailerLeaseFrequency).toBe('biweekly');
    expect(carried!.toll).toBe(40);
    expect(carried!.mileageRate).toBe(0.2);
    expect(carried!.startOdometer).toBe(0);
    expect(carried!.endOdometer).toBe(0);
    expect(carried!.otherExpenses).toEqual([
      { id: 'a', label: 'Truck wash', amount: 25, frequency: 'weekly' },
    ]);
    // Persisted as this period's own row.
    const persisted = await getWeeklyExpenses('owner-op', '2026-07-20');
    expect(persisted?.weekKey).toBe('2026-07-20');
  });

  it('per-period edits stay independent of other periods', async () => {
    const { ensureExpensesForPeriod, saveWeeklyExpenses, getWeeklyExpenses } = require('../src/storage/storage');
    await saveWeeklyExpenses('owner-op', src);
    const carried = await ensureExpensesForPeriod('owner-op', '2026-07-20');
    await saveWeeklyExpenses('owner-op', { ...carried!, truckPayment: 999 });
    expect((await getWeeklyExpenses('owner-op', '2026-07-13'))!.truckPayment).toBe(600);
    expect((await getWeeklyExpenses('owner-op', '2026-07-20'))!.truckPayment).toBe(999);
  });

  it('returns existing expenses untouched and null when there is no history', async () => {
    const { ensureExpensesForPeriod, saveWeeklyExpenses } = require('../src/storage/storage');
    expect(await ensureExpensesForPeriod('owner-op', '2026-07-20')).toBeNull();
    await saveWeeklyExpenses('owner-op', src);
    const same = await ensureExpensesForPeriod('owner-op', '2026-07-13');
    expect(same!.startOdometer).toBe(100000); // not reset — it already existed
  });

  it('one-time (1X) fixed fields reset instead of carrying forward', async () => {
    const { ensureExpensesForPeriod, saveWeeklyExpenses } = require('../src/storage/storage');
    await saveWeeklyExpenses('owner-op', {
      ...src,
      iftaCost: 150, iftaCostFrequency: 'once',
    });
    const carried = await ensureExpensesForPeriod('owner-op', '2026-07-20');
    expect(carried!.iftaCost).toBe(0);
    expect(carried!.truckPayment).toBe(600); // recurring fields still carry
  });

  it('does not carry when the source has no recurring amounts', async () => {
    const { ensureExpensesForPeriod, saveWeeklyExpenses } = require('../src/storage/storage');
    await saveWeeklyExpenses('owner-op', {
      ...src,
      truckPayment: 0, truckInsurance: 0, trailerInsurance: 0, trailerLease: 0,
      iftaCost: 0, toll: 0, adminFee: 0,
      otherExpenses: [{ id: 'b', label: 'Repair', amount: 300, frequency: 'once' }],
    });
    expect(await ensureExpensesForPeriod('owner-op', '2026-07-20')).toBeNull();
  });
});

describe('period payment confirmations', () => {
  it('mark → paid, unmark → not paid', async () => {
    expect(await isPeriodPaid('owner-op', '2026-07-13')).toBe(false);
    await markPeriodPaid('owner-op', '2026-07-13');
    expect(await isPeriodPaid('owner-op', '2026-07-13')).toBe(true);
    await unmarkPeriodPaid('owner-op', '2026-07-13');
    expect(await isPeriodPaid('owner-op', '2026-07-13')).toBe(false);
  });

  it('getPaidPeriodKeys returns only the given driver type', async () => {
    await markPeriodPaid('owner-op', '2026-07-13');
    await markPeriodPaid('owner-op', '2026-07-20');
    await markPeriodPaid('company-mile', '2026-07-13');
    const keys = await getPaidPeriodKeys('owner-op');
    expect(keys).toEqual(new Set(['2026-07-13', '2026-07-20']));
  });

  it('mark enqueues upsertPayment, unmark enqueues deletePayment', async () => {
    await markPeriodPaid('lease', '2026-07-13');
    await unmarkPeriodPaid('lease', '2026-07-13');
    const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
    const kinds = queue.map((q: any) => q.op.kind);
    expect(kinds).toContain('upsertPayment');
    expect(kinds).toContain('deletePayment');
    const up = queue.find((q: any) => q.op.kind === 'upsertPayment').op.payload;
    expect(up).toMatchObject({ driverType: 'lease', periodKey: '2026-07-13' });
    expect(typeof up.paidAt).toBe('string');
  });

  it('wipeAll clears paid keys', async () => {
    await markPeriodPaid('owner-op', '2026-07-13');
    await wipeAll();
    expect(await isPeriodPaid('owner-op', '2026-07-13')).toBe(false);
  });
});

describe('account ownership guard', () => {
  test('last user id round-trips', async () => {
    expect(await getLastUserId()).toBeNull();
    await setLastUserId('uid-1');
    expect(await getLastUserId()).toBe('uid-1');
  });

  test('wipeAll clears the last user id together with profile data', async () => {
    await setLastUserId('uid-1');
    await saveScheduleLocal({ startDate: '2026-07-13', frequency: 'weekly', payDay: 5 });
    await wipeAll();
    expect(await getLastUserId()).toBeNull();
    expect(await getSchedule()).toBeNull();
  });
});
