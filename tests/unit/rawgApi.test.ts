import { assertEquals, assertRejects } from './helpers/assert';
import {
  createRawgEnrichmentService,
  mergeGames,
  runEnrichment,
} from '@/features/backlog/services/rawgApi';
import { createSteamLibraryService } from '@/features/backlog/services/steamApi';
import { BacklogError } from '@/features/backlog/types/Game';

const row = (appid: number, genres: string[] = []) => ({
  appid,
  name: `G${appid}`,
  cover_url: null,
  genres,
  playtime: 0,
  created_at: '2026-01-01T00:00:00Z',
});
const deps = (status: number, body: unknown, calls: string[] = []) => ({
  functionsBaseUrl: 'https://x/functions/v1',
  apiKey: 'pk',
  getAccessToken: () => Promise.resolve('tok'),
  fetch: ((url: string, init: RequestInit) => {
    calls.push(`${url} ${(init.headers as Record<string, string>).Authorization}`);
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  }) as unknown as typeof fetch,
});

test('rawg service parses batch', async () => {
  const calls: string[] = [];
  const s = createRawgEnrichmentService(
    deps(200, { games: [row(1, ['RPG'])], remaining: 3, failed: 0 }, calls),
  );
  const b = await s.enrichBatch();
  assertEquals(b.remaining, 3);
  assertEquals(b.games[0]?.genres, ['rpg']);
  assertEquals(calls, ['https://x/functions/v1/rawg-enrich Bearer tok']);
});
test('rawg service bad format / 503', async () => {
  await assertRejects(
    () => createRawgEnrichmentService(deps(200, { games: [] })).enrichBatch(),
    BacklogError,
  );
  const e = await assertRejects(
    () => createRawgEnrichmentService(deps(503, { error: 'rawg_unavailable' })).enrichBatch(),
    BacklogError,
  );
  assertEquals((e as BacklogError).code, 'server');
});
test('steam service still maps private profile', async () => {
  const e = await assertRejects(
    () => createSteamLibraryService(deps(403, { error: 'private_profile' })).fetchLibrary(),
    BacklogError,
  );
  assertEquals((e as BacklogError).code, 'private_profile');
  const ok = await createSteamLibraryService({
    ...deps(200, { games: [row(5)] }),
    now: () => new Date(0),
  }).fetchLibrary();
  assertEquals(ok.games.length, 1);
  assertEquals(ok.updatedAt, new Date(0).toISOString());
});
test('mergeGames keeps order', () => {
  const snap = {
    updatedAt: 'u',
    games: [1, 2, 3].map((a) => ({
      appid: a,
      name: `G${a}`,
      coverUrl: null,
      genres: [],
      playtimeMinutes: 0,
      addedAt: 'x',
      lastPlayedAt: null,
    })),
  };
  const m = mergeGames(snap, [{ ...snap.games[1]!, genres: ['puzzle'] }]);
  assertEquals(
    m.games.map((g) => g.genres),
    [[], ['puzzle'], []],
  );
});
test('runEnrichment loops until 0, stops on no progress, caps rounds', async () => {
  const seq = [
    { games: [1], remaining: 2 },
    { games: [2], remaining: 0 },
  ];
  let i = 0;
  const seen: number[] = [];
  const svc = (s: typeof seq) => ({
    enrichBatch: () => {
      const b = s[Math.min(i++, s.length - 1)]!;
      return Promise.resolve({
        games: b.games.map((a) => ({
          appid: a,
          name: 'n',
          coverUrl: null,
          genres: [],
          playtimeMinutes: 0,
          addedAt: 'x',
          lastPlayedAt: null,
        })),
        remaining: b.remaining,
      });
    },
  });
  assertEquals(
    await runEnrichment({
      service: svc(seq),
      onBatch: (b) => {
        seen.push(b.remaining);
      },
    }),
    0,
  );
  assertEquals(seen, [2, 0]);
  i = 0;
  assertEquals(
    await runEnrichment({ service: svc([{ games: [], remaining: 5 }]), onBatch: () => {} }),
    5,
  );
  assertEquals(i, 1);
  i = 0;
  await runEnrichment({
    service: svc([{ games: [1], remaining: 9 }]),
    onBatch: () => {},
    maxRounds: 3,
  });
  assertEquals(i, 3);
});
