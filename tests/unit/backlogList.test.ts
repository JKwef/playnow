import { assertEquals, assertRejects, assertThrows } from './helpers/assert';
import {
  collectGenres,
  filterAndSortGames,
  normalizeForSearch,
} from '@/features/backlog/utils/filterGames';
import {
  generateManualAppId,
  isManualAppId,
  MANUAL_APPID_BASE,
  parseSteamAppId,
} from '@/features/backlog/utils/manualGame';
import { genreLabel } from '@/features/backlog/utils/genres';
import {
  createManualGameService,
  ManualGameError,
  manualGameErrorMessage,
} from '@/features/backlog/services/manualGames';
import type { Game } from '@/features/backlog/types/Game';
import { parseGameRow, toGameRow } from '@/features/backlog/services/parseGames';
import { formatDateTime } from '@/shared/utils/format';

const g = (
  appid: number,
  name: string,
  playtimeMinutes: number,
  genres: string[],
  addedAt: string,
  lastPlayedAt: string | null = null,
): Game => ({ appid, name, coverUrl: null, genres, playtimeMinutes, addedAt, lastPlayedAt });
const games = [
  g(1, 'Hades', 120, ['action', 'roguelike'], '2026-01-03', '2025-05-01T00:00:00Z'),
  g(2, 'Portal 2', 0, ['puzzle'], '2026-01-01'),
  g(3, 'portal', 30, ['puzzle', 'shooter', 'action'], '2026-01-02', '2026-02-01T00:00:00Z'),
  g(4, 'Ёлки Game™', 30, [], '2026-01-04'),
];
const names = (list: Game[]) => list.map((x) => x.name);

test('search: case, trademark, ё, control chars, empty', () => {
  assertEquals(names(filterAndSortGames(games, { query: 'PORT', genres: [], sort: 'name' })), [
    'portal',
    'Portal 2',
  ]);
  assertEquals(
    names(filterAndSortGames(games, { query: ' елки\n game ', genres: [], sort: 'name' })),
    ['Ёлки Game™'],
  );
  assertEquals(filterAndSortGames(games, { query: '', genres: [], sort: 'name' }).length, 4);
  assertEquals(normalizeForSearch('A  B™'), 'a b');
});
test('genre filter is AND, combines with search', () => {
  assertEquals(names(filterAndSortGames(games, { query: '', genres: ['action'], sort: 'name' })), [
    'Hades',
    'portal',
  ]);
  assertEquals(
    names(filterAndSortGames(games, { query: '', genres: ['action', 'shooter'], sort: 'name' })),
    ['portal'],
  );
  assertEquals(
    names(filterAndSortGames(games, { query: '', genres: ['roguelike', 'shooter'], sort: 'name' })),
    [],
  );
  assertEquals(
    names(filterAndSortGames(games, { query: 'portal', genres: ['shooter'], sort: 'name' })),
    ['portal'],
  );
});
test('sorts', () => {
  const s = (sort: 'name' | 'last_played_desc' | 'playtime_asc' | 'playtime_desc' | 'added_desc') =>
    names(filterAndSortGames(games, { query: '', genres: [], sort }));
  // В русской локали кириллица идёт раньше латиницы.
  assertEquals(s('name'), ['Ёлки Game™', 'Hades', 'portal', 'Portal 2']);
  assertEquals(s('playtime_asc'), ['Portal 2', 'Ёлки Game™', 'portal', 'Hades']);
  assertEquals(s('playtime_desc'), ['Hades', 'Ёлки Game™', 'portal', 'Portal 2']);
  assertEquals(s('added_desc'), ['Ёлки Game™', 'Hades', 'portal', 'Portal 2']);
  assertEquals(s('last_played_desc'), ['portal', 'Hades', 'Ёлки Game™', 'Portal 2']);
  assertEquals(games[0]!.name, 'Hades'); // input untouched
});
test('collectGenres by frequency', () => {
  assertEquals(collectGenres(games), [
    { genre: 'action', count: 2 },
    { genre: 'puzzle', count: 2 },
    { genre: 'roguelike', count: 1 },
    { genre: 'shooter', count: 1 },
  ]);
});
test('genreLabel', () => {
  assertEquals(genreLabel('rpg'), 'RPG');
  assertEquals(genreLabel('massively-multiplayer'), 'Massively multiplayer');
});
test('parseSteamAppId', () => {
  assertEquals(parseSteamAppId('620'), 620);
  assertEquals(parseSteamAppId(' https://store.steampowered.com/app/620/Portal_2/ '), 620);
  assertEquals(parseSteamAppId('store.steampowered.com/app/1145360?l=ru'), 1145360);
  assertEquals(parseSteamAppId('https://store.steampowered.com/app/'), null);
  assertEquals(parseSteamAppId('abc'), null);
  assertEquals(parseSteamAppId('0'), null);
  assertEquals(parseSteamAppId(''), null);
});
test('generateManualAppId', () => {
  const id = generateManualAppId(new Set(), () => 0.5);
  assertEquals(isManualAppId(id), true);
  assertEquals(id <= 2147483647, true);
  let n = 0;
  const id2 = generateManualAppId(new Set([MANUAL_APPID_BASE]), () => (n++ === 0 ? 0 : 0.1));
  assertEquals(id2 > MANUAL_APPID_BASE, true);
  assertThrows(() => generateManualAppId(new Set([MANUAL_APPID_BASE]), () => 0));
  assertEquals(isManualAppId(620), false);
});

const fakeClient = (
  result: { code?: string; message: string } | null,
  inserted: unknown[] = [],
  userId: string | undefined = 'u1',
) =>
  ({
    auth: {
      getSession: () =>
        Promise.resolve({ data: { session: userId ? { user: { id: userId } } : null } }),
    },
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserted.push({ table, row });
        return Promise.resolve({ error: result });
      },
    }),
  }) as never;

test('manual add inserts row with real or synthetic appid', async () => {
  const inserted: unknown[] = [];
  const svc = createManualGameService({
    getClient: () => fakeClient(null, inserted),
    random: () => 0,
  });
  await svc.addGame({ name: '  Hades ', steamAppId: 1145360, genres: ['action'] }, new Set());
  await svc.addGame({ name: 'Board', steamAppId: null, genres: [] }, new Set());
  assertEquals(inserted, [
    { table: 'games', row: { user_id: 'u1', appid: 1145360, name: 'Hades', genres: ['action'] } },
    { table: 'games', row: { user_id: 'u1', appid: MANUAL_APPID_BASE, name: 'Board', genres: [] } },
  ]);
});
test('manual add errors', async () => {
  const code = async (p: Promise<void>) =>
    ((await assertRejects(() => p, ManualGameError)) as ManualGameError).code;
  const svc = (r: { code?: string; message: string } | null, uid?: string) =>
    createManualGameService({ getClient: () => fakeClient(r, [], uid) });
  assertEquals(
    await code(svc(null).addGame({ name: '  ', steamAppId: null, genres: [] }, new Set())),
    'invalid',
  );
  assertEquals(
    await code(svc(null).addGame({ name: 'X', steamAppId: 5, genres: [] }, new Set([5]))),
    'duplicate',
  );
  assertEquals(
    await code(
      svc({ code: '23505', message: 'dup' }).addGame(
        { name: 'X', steamAppId: 5, genres: [] },
        new Set(),
      ),
    ),
    'duplicate',
  );
  assertEquals(
    await code(
      svc({ code: '', message: 'TypeError: Network request failed' }).addGame(
        { name: 'X', steamAppId: null, genres: [] },
        new Set(),
      ),
    ),
    'network',
  );
  assertEquals(
    await code(
      svc({ code: '42501', message: 'rls' }).addGame(
        { name: 'X', steamAppId: null, genres: [] },
        new Set(),
      ),
    ),
    'unauthorized',
  );
  assertEquals(
    await code(
      svc({ code: 'XX000', message: 'boom' }).addGame(
        { name: 'X', steamAppId: null, genres: [] },
        new Set(),
      ),
    ),
    'server',
  );
  assertEquals(
    manualGameErrorMessage(new ManualGameError('duplicate', '')),
    'Эта игра уже есть в вашем списке',
  );
});

test('parseGameRow lastPlayedAt + old cache without it', () => {
  const base = {
    appid: 1,
    name: 'A',
    cover_url: null,
    genres: [],
    playtime: 0,
    created_at: '2026-01-01T00:00:00Z',
  };
  assertEquals(parseGameRow(base)?.lastPlayedAt, null);
  assertEquals(parseGameRow({ ...base, last_played_at: 'garbage' })?.lastPlayedAt, null);
  const game = parseGameRow({ ...base, last_played_at: '2025-05-01T10:00:00+00:00' })!;
  assertEquals(game.lastPlayedAt, '2025-05-01T10:00:00+00:00');
  assertEquals(parseGameRow(toGameRow(game)), game);
});
test('formatDateTime adds year for past years', () => {
  const now = new Date('2026-11-01T12:00:00Z');
  assertEquals(formatDateTime('2021-03-05T12:00:00Z', now).includes('2021'), true);
  assertEquals(formatDateTime('2026-03-05T12:00:00Z', now).includes('2026'), false);
});
