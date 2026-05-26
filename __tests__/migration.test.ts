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
