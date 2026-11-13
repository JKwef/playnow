import type { GamePreference } from '@/features/backlog/types/GamePreference';
import { findContext } from '@/features/picker/utils/contexts';
import {
  filterCandidates,
  matchesContext,
  pickGame,
  priorityOf,
  rankCandidates,
} from '@/features/picker/utils/pickGame';
import { seededRandom } from '@/shared/utils/random';

import { makeGame } from './fixtures/game';

const context = findContext('action')!;
const exclude = new Set<number>();
const game = (appid: number, playtimeMinutes = 0) =>
  makeGame({ appid, playtimeMinutes, genres: ['action'] });
const preference = (
  progressStatus: GamePreference['progressStatus'],
  excluded = false,
): GamePreference => ({ progressStatus, excluded });

test('genre matching has no invented duration cutoff, including 61 minutes', () => {
  const puzzles = findContext('short-session')!;
  expect(puzzles.title).toBe('Головоломки и аркады');
  for (const minutes of [0, 59, 60, 61, 10000])
    expect(
      matchesContext(makeGame({ genres: ['puzzle'], playtimeMinutes: minutes }), puzzles),
    ).toBe(true);
  expect(matchesContext(makeGame({ genres: [] }), puzzles)).toBe(false);
  expect(
    pickGame([makeGame({ genres: ['puzzle'], playtimeMinutes: 61 })], puzzles, {
      exclude,
      random: () => 0,
      mode: 'continue',
    }),
  ).not.toBeNull();
});

test.each([
  ['unspecified', 0, 1, null],
  ['unspecified', 61, null, 1],
  ['not_started', 0, 0, null],
  ['not_started', 61, 0, null],
  ['playing', 0, null, 0],
  ['playing', 61, null, 0],
  ['completed', 0, null, null],
  ['completed', 61, null, null],
] as const)('mode priority for %s with %i minutes', (status, minutes, newTier, continueTier) => {
  const item = game(1, minutes);
  expect(priorityOf(item, 'new', preference(status))).toBe(newTier);
  expect(priorityOf(item, 'continue', preference(status))).toBe(continueTier);
  expect(priorityOf(item, 'new', preference(status, true))).toBeNull();
  expect(priorityOf(item, 'continue', preference(status, true))).toBeNull();
});

test.each(['new', 'continue'] as const)('best explicit tier always wins in mode %s', (mode) => {
  const explicit = game(1, mode === 'new' ? 10000 : 0);
  const fallback = Array.from({ length: 100 }, (_, index) =>
    game(index + 2, mode === 'new' ? 0 : 61),
  );
  const preferences = new Map([[1, preference(mode === 'new' ? 'not_started' : 'playing')]]);
  for (let seed = 0; seed < 200; seed++)
    expect(
      pickGame([...fallback, explicit], context, {
        exclude,
        mode,
        preferences,
        random: seededRandom(seed / 200),
      })?.appid,
    ).toBe(1);
});

test('all candidates in the best tier can be selected, beyond any top-ten cap', () => {
  const games = Array.from({ length: 40 }, (_, index) => game(index + 1, 500));
  const preferences = new Map(games.map((item) => [item.appid, preference('not_started')]));
  const seen = new Set<number>();
  for (let index = 0; index < games.length; index++)
    seen.add(
      pickGame(games, context, {
        exclude,
        preferences,
        random: () => (index + 0.5) / games.length,
      })!.appid,
    );
  expect(seen.size).toBe(40);
});

test('fallback becomes available only when better candidates are excluded or already shown', () => {
  const games = [game(1, 400), game(2)];
  const preferences = new Map([[1, preference('not_started')]]);
  expect(pickGame(games, context, { exclude, preferences, random: () => 0.99 })?.appid).toBe(1);
  expect(
    pickGame(games, context, { exclude: new Set([1]), preferences, random: () => 0.99 })?.appid,
  ).toBe(2);
});

test('explicit genre relaxation preserves mode, completed flags, exclusions and postponements', () => {
  const games = Array.from({ length: 5 }, (_, index) => makeGame({ appid: index + 1, genres: [] }));
  const preferences = new Map([
    [1, preference('completed')],
    [2, preference('not_started', true)],
    [4, preference('playing')],
    [5, preference('not_started')],
  ]);
  const options = { exclude: new Set([3]), preferences, mode: 'new' as const, random: () => 0 };
  expect(pickGame(games, context, options)).toBeNull();
  expect(
    filterCandidates(games, context, { ...options, ignoreGenres: true }).map((item) => item.appid),
  ).toEqual([5]);
  expect(pickGame(games, context, { ...options, ignoreGenres: true })?.appid).toBe(5);
});

test('ranking orders explicit before inferred candidates, without mutating source data', () => {
  const games = [game(1), game(2, 900), game(3)];
  const before = games.map((item) => ({ ...item }));
  const preferences = new Map([[2, preference('not_started')]]);
  const ranked = rankCandidates(games, context, { exclude, preferences, random: () => 0 });
  expect(ranked[0]?.appid).toBe(2);
  expect(new Set(ranked.map((item) => item.appid))).toEqual(new Set([1, 2, 3]));
  expect(games).toEqual(before);
});

test('empty libraries, no mode candidates and complete exclusions return null', () => {
  const options = { exclude, random: () => 0 };
  expect(pickGame([], context, options)).toBeNull();
  expect(pickGame([game(1, 50)], context, options)).toBeNull();
  expect(pickGame([game(1)], context, { ...options, exclude: new Set([1]) })).toBeNull();
  expect(pickGame([makeGame({ genres: ['rpg'] })], context, options)).toBeNull();
});

test('selection is deterministic for the same seed and handles the last random interval', () => {
  const games = Array.from({ length: 30 }, (_, index) => game(index + 1));
  expect(pickGame(games, context, { exclude, random: seededRandom(0.2) })).toEqual(
    pickGame(games, context, { exclude, random: seededRandom(0.2) }),
  );
  expect(pickGame(games, context, { exclude, random: () => 0.999999 })?.appid).toBe(30);
});
