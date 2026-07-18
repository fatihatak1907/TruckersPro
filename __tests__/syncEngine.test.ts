import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncEngine } from '../src/sync/syncEngine';
import { SYNC_QUEUE_KEY } from '../src/sync/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

jest.mock('../src/supabase/client', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: null } })) },
    from: jest.fn(),
  },
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  syncEngine.__resetForTests();
});

test('enqueue persists op to AsyncStorage', async () => {
  await syncEngine.enqueue({
    kind: 'upsertLoad',
    payload: {
      id: 'load-1',
      weekKey: '2026-05-25',
      driverType: 'owner-op',
      startLocation: 'A',
      endLocation: 'B',
      createdAt: '2026-05-25T12:00:00Z',
    } as any,
  });

  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  const queue = JSON.parse(raw!);
  expect(queue).toHaveLength(1);
  expect(queue[0].op.kind).toBe('upsertLoad');
  expect(queue[0].op.payload.id).toBe('load-1');
  expect(queue[0].attempts).toBe(0);
});

test('flush sends queued upsertLoad to supabase and removes it on success', async () => {
  const upsertMock = jest.fn((_row: any) => Promise.resolve({ error: null }));
  const fromMock = jest.fn(() => ({ upsert: upsertMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(fromMock);
  supabase.auth.getUser.mockResolvedValue({
    data: { user: { id: 'user-1' } },
  });

  await syncEngine.enqueue({
    kind: 'upsertLoad',
    payload: {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
    } as any,
  });

  await syncEngine.flush();

  expect(fromMock).toHaveBeenCalledWith('loads');
  expect(upsertMock).toHaveBeenCalledTimes(1);
  expect(upsertMock.mock.calls[0][0]).toMatchObject({
    id: 'load-1', user_id: 'user-1', week_key: '2026-05-25', driver_type: 'owner-op',
    start_location: 'A', end_location: 'B',
  });

  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  const queue = JSON.parse(raw!);
  expect(queue).toHaveLength(0);
});

test('flush leaves op in queue and records error on failure', async () => {
  const upsertMock = jest.fn((_row: any) => Promise.resolve({ error: { message: 'boom' } }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({ upsert: upsertMock }));
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  await syncEngine.enqueue({
    kind: 'upsertLoad',
    payload: {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
    } as any,
  });

  await syncEngine.flush();

  const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
  expect(queue).toHaveLength(1);
  expect(queue[0].attempts).toBe(1);
  expect(queue[0].lastError).toBe('boom');
});

test('upsertProfile sends UPDATE with name only', async () => {
  const updateMock = jest.fn((_arg: any) => ({ eq: jest.fn(() => Promise.resolve({ error: null })) }));
  const fromMock = jest.fn(() => ({ update: updateMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(fromMock);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  await syncEngine.enqueue({
    kind: 'upsertProfile',
    payload: { name: 'Fatih' },
  });

  await syncEngine.flush();

  expect(fromMock).toHaveBeenCalledWith('profiles');
  expect(updateMock).toHaveBeenCalledTimes(1);
  const arg = updateMock.mock.calls[0][0];
  expect(arg.name).toBe('Fatih');
  expect(arg.driver_type).toBeUndefined();
});

test('upsertExpenses payload includes mileage_rate (default 0.14)', async () => {
  let capturedUpsert: any = null;
  const upsertMock = jest.fn((row: any) => {
    capturedUpsert = row;
    return Promise.resolve({ error: null });
  });
  const fromMock = jest.fn(() => ({ upsert: upsertMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(fromMock);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  await syncEngine.enqueue({
    kind: 'upsertExpenses',
    payload: {
      weekKey: '2026-05-25', driverType: 'lease',
      truckPayment: 0, truckPaymentFrequency: 'weekly',
      truckInsurance: 0, truckInsuranceFrequency: 'weekly',
      trailerInsurance: 0, trailerInsuranceFrequency: 'weekly',
      trailerLease: 0, trailerLeaseFrequency: 'weekly',
      iftaCost: 0, iftaCostFrequency: 'weekly',
      adminFee: 0, adminFeeFrequency: 'weekly',
      other: 0, otherFrequency: 'weekly', otherExpenses: [],
      startOdometer: 0, endOdometer: 0,
    } as any,
  });

  await syncEngine.flush();

  expect(fromMock).toHaveBeenCalledWith('weekly_expenses');
  expect(capturedUpsert.mileage_rate).toBe(0.14);
});

test('upsertExpenses payload carries custom mileageRate', async () => {
  let capturedUpsert: any = null;
  const upsertMock = jest.fn((row: any) => {
    capturedUpsert = row;
    return Promise.resolve({ error: null });
  });
  const fromMock = jest.fn(() => ({ upsert: upsertMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(fromMock);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

  await syncEngine.enqueue({
    kind: 'upsertExpenses',
    payload: {
      weekKey: '2026-05-25', driverType: 'lease',
      truckPayment: 0, truckPaymentFrequency: 'weekly',
      truckInsurance: 0, truckInsuranceFrequency: 'weekly',
      trailerInsurance: 0, trailerInsuranceFrequency: 'weekly',
      trailerLease: 0, trailerLeaseFrequency: 'weekly',
      iftaCost: 0, iftaCostFrequency: 'weekly',
      adminFee: 0, adminFeeFrequency: 'weekly',
      other: 0, otherFrequency: 'weekly', otherExpenses: [],
      startOdometer: 0, endOdometer: 0,
      mileageRate: 0.2,
    } as any,
  });

  await syncEngine.flush();

  expect(capturedUpsert.mileage_rate).toBe(0.2);
});

test('flush is a no-op when no user is signed in', async () => {
  const upsertMock = jest.fn(() => Promise.resolve({ error: null }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({ upsert: upsertMock }));
  supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

  await syncEngine.enqueue({
    kind: 'upsertLoad',
    payload: {
      id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
      startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
    } as any,
  });
  await syncEngine.flush();

  expect(upsertMock).not.toHaveBeenCalled();
  const queue = JSON.parse((await AsyncStorage.getItem(SYNC_QUEUE_KEY))!);
  expect(queue).toHaveLength(1);
});
