import {
  createGamePreferencesService,
  parsePreference,
} from '@/features/backlog/services/gamePreferences';
import { createGamePreferencesCache } from '@/features/backlog/services/gamePreferencesCache';
import { clearAccountData } from '@/shared/services/accountData';
import type { GamePreference, GamePreferences } from '@/features/backlog/types/GamePreference';
import { isBlockedByPreference } from '@/features/backlog/types/GamePreference';
import { pickGame } from '@/features/picker/utils/pickGame';
import { findContext } from '@/features/picker/utils/contexts';

import { makeGame } from './fixtures/game';

const A = '76561197960287930';
const fixture = (rows: unknown[] = [], account: string | null = A) => {
  let after = 0;
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    gt: jest.fn(function (this: object, _field: string, cursor: number): object {
      after = cursor;
      return this;
    }),
    limit: jest.fn(async (limit: number) => ({
      data: rows.filter((row) => (row as { appid: number }).appid > after).slice(0, limit),
      error: null,
    })),
  };
  const rpc = jest.fn(
    async (
      _name: string,
      args: { target_appid: number; new_status?: string; new_excluded?: boolean },
    ) => ({
      data: [
        {
          appid: args.target_appid,
          progress_status: args.new_status ?? 'playing',
          excluded: args.new_excluded ?? true,
        },
      ],
      error: null,
    }),
  );
  const client = {
    auth: {
      getSession: async () => ({
        data: {
          session:
            account === null
              ? null
              : { user: { id: 'user-A', app_metadata: { steam_id: account } } },
        },
        error: null,
      }),
    },
    from: jest.fn(() => builder),
    rpc,
  };
  return { builder, rpc, client, service: createGamePreferencesService(() => client as never) };
};

test('progression defaults to unspecified; only explicit completion and exclusion block picking', () => {
  const games = [makeGame({ appid: 1, genres: ['action'], playtimeMinutes: 61 })];
  const options = { exclude: new Set<number>(), random: () => 0 };
  expect(pickGame(games, findContext('action')!, { ...options, mode: 'continue' })?.appid).toBe(1);
  for (const progressStatus of ['unspecified', 'not_started', 'playing', 'completed'] as const) {
    for (const excluded of [false, true]) {
      const preference = { progressStatus, excluded };
      const blocked = excluded || progressStatus === 'completed';
      expect(isBlockedByPreference(preference)).toBe(blocked);
      expect(
        pickGame(games, findContext('action')!, {
          ...options,
          mode: progressStatus === 'not_started' ? 'new' : 'continue',
          preferences: new Map([[1, preference]]),
        }) === null,
      ).toBe(blocked);
    }
  }
  expect(games[0]?.playtimeMinutes).toBe(61);
  expect(games[0]?.genres).toEqual(['action']);
  expect(pickGame(games, findContext('action')!, { ...options, exclude: new Set([1]) })).toBeNull();
});

test('all 1500 preferences are read in stable pages, including high manual appids', async () => {
  const rows = Array.from({ length: 1500 }, (_, index) => ({
    appid: index === 1499 ? 2_000_000_001 : index + 1,
    progress_status: 'playing',
    excluded: index % 2 === 0,
  }));
  const { service, builder } = fixture(rows);
  const values = await service.fetch(A);
  expect(values.size).toBe(1500);
  expect(values.get(2_000_000_001)?.progressStatus).toBe('playing');
  expect(builder.limit).toHaveBeenCalledTimes(4);
  expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-A');
});

test('save sends only requested fields and the confirmed identity to the atomic RPC', async () => {
  const { service, rpc } = fixture();
  expect(await service.save(A, 1, { progressStatus: 'completed' })).toEqual({
    progressStatus: 'completed',
    excluded: true,
  });
  expect(rpc).toHaveBeenLastCalledWith('set_game_preference', {
    target_appid: 1,
    expected_user_id: 'user-A',
    new_status: 'completed',
  });
  expect(await service.save(A, 1, { excluded: false })).toEqual({
    progressStatus: 'playing',
    excluded: false,
  });
  expect(rpc).toHaveBeenLastCalledWith('set_game_preference', {
    target_appid: 1,
    expected_user_id: 'user-A',
    new_excluded: false,
  });
});

test('invalid preferences, stale accounts and missing sessions cannot be saved', async () => {
  const { service, rpc } = fixture();
  for (const patch of [{}, { progressStatus: 'bad' }, { excluded: 'yes' }])
    await expect(service.save(A, 1, patch as never)).rejects.toThrow();
  await expect(service.save(A, -1, { excluded: true })).rejects.toThrow();
  expect(rpc).not.toHaveBeenCalled();
  for (const account of ['B', null]) {
    const changed = fixture([], account);
    await expect(changed.service.save(A, 1, { excluded: true })).rejects.toMatchObject({
      code: 'unauthorized',
    });
    expect(changed.rpc).not.toHaveBeenCalled();
  }
});

test('bad server responses cannot silently drop permanent exclusions', async () => {
  for (const row of [
    null,
    { appid: 1, progress_status: 'bad', excluded: true },
    { appid: 1, progress_status: 'playing', excluded: 'true' },
  ])
    expect(parsePreference(row)).toBeNull();
  const { service, rpc } = fixture();
  rpc.mockResolvedValueOnce({ data: [], error: null });
  await expect(service.save(A, 1, { excluded: true })).rejects.toThrow();
});

test('account preference cache preserves flags, isolates accounts and is cleared on deletion', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
    getAllKeys: async () => [...values.keys()],
    multiRemove: async (keys: string[]) => {
      keys.forEach((key) => values.delete(key));
    },
  };
  const cache = createGamePreferencesCache(storage);
  const preferences: GamePreferences = new Map<number, GamePreference>([
    [1, { progressStatus: 'completed', excluded: true }],
  ]);
  await cache.write(A, preferences);
  expect(await cache.read(A)).toEqual(preferences);
  expect(await cache.read('B')).toBeNull();
  values.set('quaeso:theme', 'light');
  await clearAccountData(A, storage);
  expect(await cache.read(A)).toBeNull();
  expect(values.get('quaeso:theme')).toBe('light');
});
