import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYNC_MIGRATED_KEY } from '../src/sync/types';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => () => {}),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
}));

const upsertMock = jest.fn(() => Promise.resolve({ error: null }));
const selectChain = (data: any[]) => ({
  select: () => ({ eq: () => Promise.resolve({ data, error: null }) }),
});

jest.mock('../src/supabase/client', () => ({
  supabase: {
    auth: { getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })) },
    from: jest.fn(),
  },
}));

beforeEach(async () => {
  await AsyncStorage.clear();
  upsertMock.mockClear();
});

test('Path A: local data uploads on first login, then migrated flag is set', async () => {
  await AsyncStorage.setItem('loads:owner-op:2026-05-25', JSON.stringify([{
    id: 'load-1', weekKey: '2026-05-25', driverType: 'owner-op',
    startLocation: 'A', endLocation: 'B', createdAt: '2026-05-25T12:00:00Z',
  }]));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({
    upsert: upsertMock,
    ...selectChain([]),
  }));

  const { runMigrationAndPull } = require('../src/sync/migration');
  await runMigrationAndPull('user-1');

  expect(upsertMock).toHaveBeenCalled();
  expect(await AsyncStorage.getItem(SYNC_MIGRATED_KEY)).toBe('true');
});

test('Path B: fresh device pulls Supabase data into AsyncStorage', async () => {
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation((table: string) => {
    if (table === 'loads') {
      return selectChain([{
        id: 'load-remote', user_id: 'user-1', week_key: '2026-05-25',
        driver_type: 'owner-op', start_location: 'X', end_location: 'Y',
        earnings: 200, created_at: '2026-05-25T10:00:00Z',
      }]);
    }
    return selectChain([]);
  });

  const { runMigrationAndPull } = require('../src/sync/migration');
  await runMigrationAndPull('user-1');

  const raw = await AsyncStorage.getItem('loads:owner-op:2026-05-25');
  const loads = JSON.parse(raw!);
  expect(loads).toHaveLength(1);
  expect(loads[0].id).toBe('load-remote');
  expect(await AsyncStorage.getItem(SYNC_MIGRATED_KEY)).toBe('true');
});

test('pullFromSupabase writes both driver_type and name from profile row', async () => {
  const { supabase } = require('../src/supabase/client');
  const selectChain = (data: any[]) => ({
    select: () => ({ eq: () => Promise.resolve({ data, error: null }) }),
  });
  supabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return selectChain([{
        user_id: 'user-1',
        driver_type: 'lease',
        name: 'Test Driver',
      }]);
    }
    return selectChain([]);
  });

  const { pullFromSupabase } = require('../src/storage/storage');
  await pullFromSupabase('user-1');

  expect(await AsyncStorage.getItem('profile:name')).toBe('Test Driver');
  expect(await AsyncStorage.getItem('profile:driver_type')).toBe('lease');
});

test('Path A uploads a locally stored pay schedule', async () => {
  await AsyncStorage.setItem(
    'profile:schedule',
    JSON.stringify({ startDate: '2026-07-15', frequency: 'biweekly', payDay: 5 })
  );
  const eqMock = jest.fn(() => Promise.resolve({ error: null }));
  const updateMock = jest.fn((_arg: any) => ({ eq: eqMock }));
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation(() => ({
    upsert: upsertMock,
    update: updateMock,
    ...selectChain([]),
  }));

  const { runMigrationAndPull } = require('../src/sync/migration');
  await runMigrationAndPull('user-1');

  expect(updateMock).toHaveBeenCalled();
  expect(updateMock.mock.calls[0][0]).toMatchObject({
    schedule_start_date: '2026-07-15',
    schedule_frequency: 'biweekly',
    schedule_pay_day: 5,
  });
});

test('pullFromSupabase maps schedule columns into profile:schedule', async () => {
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return selectChain([{
        user_id: 'user-1', driver_type: 'owner-op', name: 'D',
        schedule_start_date: '2026-07-15', schedule_frequency: 'biweekly', schedule_pay_day: 3,
      }]);
    }
    return selectChain([]);
  });

  const { pullFromSupabase } = require('../src/storage/storage');
  await pullFromSupabase('user-1');

  expect(JSON.parse((await AsyncStorage.getItem('profile:schedule'))!)).toEqual({
    startDate: '2026-07-15',
    frequency: 'biweekly',
    payDay: 3,
  });
});

test('pullFromSupabase leaves profile:schedule unset when schedule_start_date is null', async () => {
  const { supabase } = require('../src/supabase/client');
  supabase.from.mockImplementation((table: string) => {
    if (table === 'profiles') {
      return selectChain([{
        user_id: 'user-1', driver_type: 'owner-op', name: 'D',
        schedule_start_date: null, schedule_frequency: 'weekly', schedule_pay_day: 5,
      }]);
    }
    return selectChain([]);
  });

  const { pullFromSupabase } = require('../src/storage/storage');
  await pullFromSupabase('user-1');

  expect(await AsyncStorage.getItem('profile:schedule')).toBeNull();
});
