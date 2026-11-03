import { assertEquals } from './helpers/assert';
import { createSteamLibraryService } from '@/features/backlog/services/steamApi';
import { createBacklogCache } from '@/features/backlog/services/backlogCache';
import { parseGameRows } from '@/features/backlog/services/parseGames';
import { formatPlaytime } from '@/shared/utils/format';
import { sanitizeSearchQuery } from '@/shared/utils/validation';

const row = {
  appid: 730,
  name: 'CS2',
  cover_url: 'https://x/h.jpg',
  genres: ['Action', 1],
  playtime: 90,
  created_at: '2026-11-01T00:00:00Z',
};
const svc = (resp: () => Promise<Response>, token: string | null = 't') =>
  createSteamLibraryService({
    functionsBaseUrl: 'https://p/functions/v1',
    apiKey: 'k',
    getAccessToken: async () => token,
    fetch: (async (_u: unknown, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>).Authorization !== 'Bearer t')
        throw new Error('no auth');
      return resp();
    }) as typeof fetch,
    now: () => new Date('2026-11-01T12:00:00Z'),
  });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'none';
  } catch (e) {
    return (e as { code: string }).code;
  }
};

test('parseGameRows validates', () => {
  assertEquals(
    parseGameRows([row, { appid: 'x' }, { ...row, cover_url: 'http://insecure', appid: 1 }, row]),
    [
      {
        appid: 730,
        name: 'CS2',
        coverUrl: 'https://x/h.jpg',
        genres: ['action'],
        playtimeMinutes: 90,
        addedAt: '2026-11-01T00:00:00Z',
        lastPlayedAt: null,
      },
      {
        appid: 1,
        name: 'CS2',
        coverUrl: null,
        genres: ['action'],
        playtimeMinutes: 90,
        addedAt: '2026-11-01T00:00:00Z',
        lastPlayedAt: null,
      },
    ],
  );
  assertEquals(parseGameRows('nope'), null);
});
test('steamApi success + error mapping', async () => {
  const ok = await svc(async () => new Response(JSON.stringify({ games: [row] }))).fetchLibrary();
  assertEquals(ok.games.length, 1);
  assertEquals(ok.updatedAt, '2026-11-01T12:00:00.000Z');
  assertEquals(
    await code(
      svc(async () => new Response('{"error":"private_profile"}', { status: 403 })).fetchLibrary(),
    ),
    'private_profile',
  );
  assertEquals(
    await code(svc(async () => new Response('x', { status: 401 })).fetchLibrary()),
    'unauthorized',
  );
  assertEquals(
    await code(svc(async () => new Response('<html>', { status: 502 })).fetchLibrary()),
    'steam_unavailable',
  );
  assertEquals(
    await code(svc(async () => new Response('x', { status: 500 })).fetchLibrary()),
    'server',
  );
  assertEquals(
    await code(
      svc(async () => {
        throw new TypeError('Network request failed');
      }).fetchLibrary(),
    ),
    'network',
  );
  assertEquals(await code(svc(async () => new Response('{"games":5}')).fetchLibrary()), 'server');
  assertEquals(
    await code(svc(async () => new Response('{}'), null).fetchLibrary()),
    'unauthorized',
  );
});
test('cache roundtrip, per user, corrupt', async () => {
  const m = new Map<string, string>();
  const st = {
    getItem: async (k: string) => m.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      m.set(k, v);
    },
    removeItem: async (k: string) => {
      m.delete(k);
    },
  };
  const c = createBacklogCache(st);
  const snap = { games: parseGameRows([row])!, updatedAt: '2026-11-01T12:00:00.000Z' };
  await c.write('A', snap);
  assertEquals(await c.read('A'), snap);
  assertEquals(await c.read('B'), null);
  m.set('playnow:backlog:v1:A', '{bad json');
  assertEquals(await c.read('A'), null);
});
test('format + sanitize', () => {
  assertEquals(
    [formatPlaytime(0), formatPlaytime(45), formatPlaytime(120), formatPlaytime(725)],
    ['Не запускалась', '45 мин', '2 ч', '12 ч 5 мин'],
  );
  assertEquals(sanitizeSearchQuery('  Hal\u0000f   Life\n2 '), 'Half Life 2');
});
