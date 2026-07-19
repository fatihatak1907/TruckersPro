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
