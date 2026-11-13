import { createBacklogCache } from '@/features/backlog/services/backlogCache';
import { parseGameRow, toGameRow } from '@/features/backlog/services/parseGames';
import {
  createRawgEnrichmentService,
  mergeGames,
  runEnrichment,
} from '@/features/backlog/services/rawgApi';

import { makeGame } from './fixtures/game';

test('explicit genre correction wins over RAWG and survives serialization in the old cache format', async () => {
  const game = parseGameRow({
    appid: 1,
    name: 'Game',
    genres: ['Action'],
    genres_override: ['Puzzle'],
    rawg_checked_at: null,
  })!;
  expect(game.genres).toEqual(['puzzle']);
  expect(game.importedGenres).toEqual(['action']);
  expect(parseGameRow(toGameRow(game))).toEqual(game);
  const storage = new Map<string, string>();
  const cache = createBacklogCache({
    getItem: async (key) => storage.get(key) ?? null,
    setItem: async (key, value) => {
      storage.set(key, value);
    },
    removeItem: async (key) => {
      storage.delete(key);
    },
  });
  const snapshot = { games: [game], updatedAt: '2026-11-13', metadataRemaining: 14 };
  await cache.write('A', snapshot);
  expect(await cache.read('A')).toEqual(snapshot);
});

test('late enrichment response preserves a manual correction and its explicit reset', () => {
  const update = makeGame({ genres: ['action'], importedGenres: ['action'], genresOverride: null });
  for (const override of [['puzzle'], null]) {
    const current = makeGame({ genres: override ?? ['rpg'], genresOverride: override });
    const merged = mergeGames({ games: [current], updatedAt: 'date' }, [update]);
    expect(merged.games[0]?.genresOverride).toEqual(override);
    expect(merged.games[0]?.genres).toEqual(override ?? ['action']);
  }
});

test('a partially failed or rate-limited batch persists progress and stops until an explicit retry', async () => {
  for (const failure of [{ failed: 1 }, { interrupted: true }]) {
    const enrichBatch = jest.fn(async () => ({ games: [makeGame()], remaining: 25, ...failure }));
    const onBatch = jest.fn();
    expect(await runEnrichment({ service: { enrichBatch }, onBatch })).toBe(25);
    expect(onBatch).toHaveBeenCalledWith(expect.objectContaining({ remaining: 25 }));
    expect(enrichBatch).toHaveBeenCalledTimes(1);
  }
});

test('round cap returns unfinished count; an invalid limit cannot report fake completion', async () => {
  let remaining = 20;
  expect(
    await runEnrichment({
      service: { enrichBatch: async () => ({ games: [makeGame()], remaining: --remaining }) },
      onBatch: () => undefined,
      maxRounds: 2,
    }),
  ).toBe(18);
  await expect(
    runEnrichment({ service: { enrichBatch: jest.fn() }, onBatch: jest.fn(), maxRounds: 0 }),
  ).rejects.toThrow();
});

test('network failure after a batch preserves the last completed batch for resumption', async () => {
  const enrichBatch = jest
    .fn()
    .mockResolvedValueOnce({ games: [makeGame()], remaining: 12 })
    .mockRejectedValueOnce(new Error('RAWG down'));
  const onBatch = jest.fn();
  await expect(runEnrichment({ service: { enrichBatch }, onBatch })).rejects.toThrow('RAWG down');
  expect(onBatch).toHaveBeenCalledTimes(1);
  expect(onBatch).toHaveBeenCalledWith(expect.objectContaining({ remaining: 12 }));
});

test('aborting a completed in-flight request prevents saving and starting another batch', async () => {
  const controller = new AbortController();
  const onBatch = jest.fn();
  const enrichBatch = jest.fn(async () => {
    controller.abort();
    return { games: [makeGame()], remaining: 30 };
  });
  await expect(
    runEnrichment({ service: { enrichBatch }, onBatch, signal: controller.signal }),
  ).rejects.toThrow();
  expect(onBatch).not.toHaveBeenCalled();
  expect(enrichBatch).toHaveBeenCalledTimes(1);
});

test('RAWG client exposes partial-failure information', async () => {
  const service = createRawgEnrichmentService({
    functionsBaseUrl: 'https://example.com',
    apiKey: 'public',
    getAccessToken: async () => 'token',
    fetch: jest.fn(
      async () =>
        new Response(JSON.stringify({ games: [], remaining: 5, failed: 2, interrupted: true })),
    ) as typeof fetch,
  });
  expect(await service.enrichBatch()).toEqual({
    games: [],
    remaining: 5,
    failed: 2,
    interrupted: true,
  });
});
