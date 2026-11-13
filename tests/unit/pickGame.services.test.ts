import { assert, assertEquals } from './helpers/assert';
import {
  matchesContext,
  pickGame,
  priorityOf,
  rankCandidates,
  TOP_CANDIDATES,
} from '@/features/picker/utils/pickGame';
import { findContext, PICKER_CONTEXTS } from '@/features/picker/utils/contexts';
import { createBlacklistService, POSTPONE_DAYS } from '@/features/picker/services/blacklist';
import { seededRandom } from '@/shared/utils/random';
import type { Game } from '@/features/backlog/types/Game';

const g = (appid: number, genres: string[], playtimeMinutes: number): Game => ({
  appid,
  name: `G${appid}`,
  coverUrl: null,
  genres,
  playtimeMinutes,
  addedAt: 'x',
  lastPlayedAt: null,
});
const ctx = (id: string) => findContext(id)!;
const none = new Set<number>();

test('4 contexts as in FR4.1', () => {
  assertEquals(
    PICKER_CONTEXTS.map((c) => c.id),
    ['short-session', 'addictive', 'story', 'action'],
  );
  assertEquals(findContext('nope'), undefined);
});
test('matchesContext: any genre + playtime limit for 30 min', () => {
  assert(matchesContext(g(1, ['puzzle'], 59), ctx('short-session')));
  assert(!matchesContext(g(1, ['puzzle'], 60), ctx('short-session')));
  assert(!matchesContext(g(1, ['rpg'], 0), ctx('short-session')));
  assert(matchesContext(g(1, ['roguelike', 'indie'], 5000), ctx('addictive')));
  assert(matchesContext(g(1, ['narrative'], 0), ctx('story')));
  assert(!matchesContext(g(1, [], 0), ctx('action')));
});
test('priority tiers', () => {
  assertEquals(
    [0, 1, 119, 120, 5000].map((p) => priorityOf(g(1, [], p))),
    [0, 1, 1, 2, 2],
  );
});
test('rank: unplayed first, then <120, then rest; excluded removed', () => {
  const games = [
    g(1, ['action'], 500),
    g(2, ['action'], 30),
    g(3, ['action'], 0),
    g(4, ['rpg'], 0),
    g(5, ['action'], 0),
  ];
  for (let s = 0; s < 20; s++) {
    const ranked = rankCandidates(games, ctx('action'), {
      exclude: new Set([5]),
      random: seededRandom(s / 20),
    });
    assertEquals(
      ranked.map((x) => x.appid),
      [3, 2, 1],
    );
  }
});
test('pick only from top 10, all of top reachable, randomized', () => {
  const games = [
    ...Array.from({ length: 12 }, (_, i) => g(i + 1, ['action'], 0)),
    ...Array.from({ length: 30 }, (_, i) => g(100 + i, ['action'], 999)),
  ];
  const seen = new Set<number>();
  for (let s = 0; s < 400; s++) {
    const picked = pickGame(games, ctx('action'), {
      exclude: none,
      random: seededRandom(s / 400),
    })!;
    assert(picked.appid <= 12, `picked played game ${picked.appid}`);
    seen.add(picked.appid);
  }
  assert(seen.size >= 10, `variety ${seen.size}`);
  assertEquals(TOP_CANDIDATES, 10);
});
test('pick null when nothing matches; deterministic per seed; fast on 500', () => {
  assertEquals(
    pickGame([g(1, ['rpg'], 0)], ctx('action'), { exclude: none, random: Math.random }),
    null,
  );
  const games = Array.from({ length: 500 }, (_, i) => g(i + 1, i % 2 ? ['action'] : ['rpg'], i));
  const a = pickGame(games, ctx('action'), { exclude: none, random: seededRandom(0.42) });
  const b = pickGame(games, ctx('action'), { exclude: none, random: seededRandom(0.42) });
  assertEquals(a, b);
  const t = performance.now();
  for (let i = 0; i < 100; i++)
    pickGame(games, ctx('action'), { exclude: none, random: seededRandom(i / 100) });
  assert((performance.now() - t) / 100 < 50, 'pick < 50ms');
});
test('seededRandom in [0,1)', () => {
  const r = seededRandom(0.123);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert(v >= 0 && v < 1);
  }
});
test('blacklist: add, expire after 7 days, per account, invalid data', async () => {
  const mem = new Map<string, string>();
  let clock = 1_000_000;
  const storage = {
    getItem: (k: string) => Promise.resolve(mem.get(k) ?? null),
    setItem: (k: string, v: string) => {
      mem.set(k, v);
      return Promise.resolve();
    },
    removeItem: (k: string) => {
      mem.delete(k);
      return Promise.resolve();
    },
  };
  const svc = createBlacklistService(storage, () => clock);
  await svc.add('A', 730);
  assertEquals([...(await svc.read('A')).keys()], [730]);
  assertEquals((await svc.read('B')).size, 0);
  clock += POSTPONE_DAYS * 86400000 - 1;
  assertEquals((await svc.read('A')).size, 1);
  clock += 2;
  assertEquals((await svc.read('A')).size, 0);
  assertEquals(mem.get('playnow:blacklist:v1:A'), '{}');
  mem.set('playnow:blacklist:v1:C', '{"x":1,"5":"soon","-1":99999999999,"7":99999999999}');
  assertEquals([...(await svc.read('C')).keys()], [7]);
  mem.set('playnow:blacklist:v1:D', 'not json');
  assertEquals((await svc.read('D')).size, 0);
});
