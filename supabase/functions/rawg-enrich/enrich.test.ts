// Запуск: deno test supabase/functions/rawg-enrich/
import { assertEquals } from 'jsr:@std/assert@1';

import { enrichGames, type GameUpdate, type PendingGame, RawgFatalError } from './enrich.ts';

const game = (id: string, extra: Partial<PendingGame> = {}): PendingGame => ({
  id,
  name: `Game ${id}`,
  coverUrl: `https://steam/${id}.jpg`,
  genres: [],
  ...extra,
});

const baseDeps = (saved: GameUpdate[]) => ({
  save: (update: GameUpdate) => {
    saved.push(update);
    return Promise.resolve();
  },
  concurrency: 3,
  deadline: Number.POSITIVE_INFINITY,
  now: () => 0,
});

Deno.test(
  'enrichGames: жанры из RAWG, обложку Steam не трогает, ручные жанры сохраняет',
  async () => {
    const saved: GameUpdate[] = [];
    const result = await enrichGames(
      [game('1'), game('2', { coverUrl: null }), game('3', { genres: ['rpg'] })],
      {
        ...baseDeps(saved),
        findMatch: () => Promise.resolve({ genres: ['puzzle'], coverUrl: 'https://rawg/x.jpg' }),
      },
    );
    assertEquals(result.updated.sort(), ['1', '2', '3']);
    const byId = Object.fromEntries(saved.map((u) => [u.id, u]));
    assertEquals(byId['1'], { id: '1', genres: ['puzzle'], coverUrl: 'https://steam/1.jpg' });
    assertEquals(byId['2'], { id: '2', genres: ['puzzle'], coverUrl: 'https://rawg/x.jpg' });
    assertEquals(byId['3']?.genres, ['rpg']);
  },
);

Deno.test('enrichGames: не найдено → [] и пометка; сбой → игра остаётся на потом', async () => {
  const saved: GameUpdate[] = [];
  const result = await enrichGames([game('1'), game('2')], {
    ...baseDeps(saved),
    findMatch: (name) =>
      name === 'Game 1' ? Promise.resolve(null) : Promise.reject(new Error('timeout')),
  });
  assertEquals(result.updated, ['1']);
  assertEquals(result.failed, 1);
  assertEquals(saved, [{ id: '1', genres: [], coverUrl: 'https://steam/1.jpg' }]);
});

Deno.test('enrichGames: ошибка ключа останавливает партию', async () => {
  const saved: GameUpdate[] = [];
  let calls = 0;
  const result = await enrichGames(
    Array.from({ length: 20 }, (_, i) => game(String(i))),
    {
      ...baseDeps(saved),
      concurrency: 1,
      findMatch: () => {
        calls += 1;
        return Promise.reject(new RawgFatalError('bad_key', '401'));
      },
    },
  );
  assertEquals(calls, 1);
  assertEquals(result.fatal?.reason, 'bad_key');
  assertEquals(saved.length, 0);
});

Deno.test('enrichGames: после дедлайна новые игры не начинает', async () => {
  const saved: GameUpdate[] = [];
  let clock = 0;
  const result = await enrichGames(
    Array.from({ length: 10 }, (_, i) => game(String(i))),
    {
      ...baseDeps(saved),
      concurrency: 1,
      deadline: 3,
      now: () => clock,
      findMatch: () => {
        clock += 1;
        return Promise.resolve(null);
      },
    },
  );
  assertEquals(result.updated.length, 3);
});

Deno.test('enrichGames: не больше concurrency запросов одновременно', async () => {
  let active = 0;
  let peak = 0;
  await enrichGames(
    Array.from({ length: 12 }, (_, i) => game(String(i))),
    {
      ...baseDeps([]),
      concurrency: 4,
      findMatch: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return null;
      },
    },
  );
  assertEquals(peak, 4);
});
