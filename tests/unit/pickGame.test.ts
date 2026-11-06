import type { Game } from '@/features/backlog/types/Game';
import type { PickerContext } from '@/features/picker/types';
import {
  BARELY_PLAYED_MINUTES,
  matchesContext,
  pickGame,
  priorityOf,
  rankCandidates,
  TOP_CANDIDATES,
} from '@/features/picker/utils/pickGame';
import { seededRandom } from '@/shared/utils/random';

import { makeGame } from './fixtures/game';

const makeContext = (overrides: Partial<PickerContext> = {}): PickerContext => ({
  id: 'story',
  title: 'Хочу сюжетку',
  description: 'RPG и приключения',
  icon: '📖',
  genres: ['rpg'],
  ...overrides,
});

const noExclude: ReadonlySet<number> = new Set<number>();
const constantRandom =
  (value: number): (() => number) =>
  () =>
    value;

const appids = (games: readonly Game[]): number[] => games.map((game) => game.appid);

describe('matchesContext', () => {
  it('подходит игра хотя бы с одним жанром контекста', () => {
    expect(matchesContext(makeGame({ genres: ['rpg', 'adventure'] }), makeContext())).toBe(true);
    expect(
      matchesContext(
        makeGame({ genres: ['adventure'] }),
        makeContext({ genres: ['rpg', 'adventure'] }),
      ),
    ).toBe(true);
  });

  it('не подходит игра без общих жанров', () => {
    expect(matchesContext(makeGame({ genres: ['action'] }), makeContext())).toBe(false);
  });

  it('игра без жанров не подходит', () => {
    expect(matchesContext(makeGame({ genres: [] }), makeContext())).toBe(false);
  });

  it('без лимита времени наигранные часы не мешают', () => {
    expect(
      matchesContext(makeGame({ genres: ['rpg'], playtimeMinutes: 10000 }), makeContext()),
    ).toBe(true);
  });

  it('лимит времени строгий: ровно на границе игра не подходит', () => {
    const context = makeContext({ maxPlaytimeMinutes: 60 });
    expect(matchesContext(makeGame({ genres: ['rpg'], playtimeMinutes: 59 }), context)).toBe(true);
    expect(matchesContext(makeGame({ genres: ['rpg'], playtimeMinutes: 60 }), context)).toBe(false);
    expect(matchesContext(makeGame({ genres: ['rpg'], playtimeMinutes: 61 }), context)).toBe(false);
  });
});

describe('priorityOf', () => {
  const cases: [number, number][] = [
    [0, 0],
    [1, 1],
    [59, 1],
    [BARELY_PLAYED_MINUTES - 1, 1],
    [BARELY_PLAYED_MINUTES, 2],
    [5000, 2],
  ];

  for (const [minutes, expected] of cases) {
    it(`приоритет для ${minutes} мин — ${expected}`, () => {
      expect(priorityOf(makeGame({ playtimeMinutes: minutes }))).toBe(expected);
    });
  }

  it('не запускавшаяся игра — самый высокий приоритет', () => {
    expect(priorityOf(makeGame({ playtimeMinutes: 0 }))).toBe(0);
  });
});

describe('rankCandidates', () => {
  it('пустой список даёт пустой результат', () => {
    expect(
      rankCandidates([], makeContext(), { exclude: noExclude, random: constantRandom(0.5) }),
    ).toEqual([]);
  });

  it('отбрасывает исключённые appid', () => {
    const games = [
      makeGame({ appid: 1, genres: ['rpg'] }),
      makeGame({ appid: 2, genres: ['rpg'] }),
    ];
    const result = rankCandidates(games, makeContext(), {
      exclude: new Set([1]),
      random: constantRandom(0.5),
    });
    expect(appids(result)).toEqual([2]);
  });

  it('отбрасывает игры, не подходящие под контекст', () => {
    const games = [
      makeGame({ appid: 1, genres: ['rpg'] }),
      makeGame({ appid: 2, genres: ['action'] }),
    ];
    const result = rankCandidates(games, makeContext(), {
      exclude: noExclude,
      random: constantRandom(0.5),
    });
    expect(appids(result)).toEqual([1]);
  });

  it('сортирует по приоритету, а внутри приоритета — по перемешанному порядку', () => {
    const games = [
      makeGame({ appid: 1, name: 'A', genres: ['rpg'], playtimeMinutes: 500 }),
      makeGame({ appid: 2, name: 'B', genres: ['rpg'], playtimeMinutes: 0 }),
      makeGame({ appid: 3, name: 'C', genres: ['rpg'], playtimeMinutes: 60 }),
    ];
    const result = rankCandidates(games, makeContext(), {
      exclude: noExclude,
      random: constantRandom(0),
    });
    expect(appids(result)).toEqual([2, 3, 1]);
  });

  it('перемешивание детерминировано при random = () => 0', () => {
    const games = [
      makeGame({ appid: 1, genres: ['rpg'] }),
      makeGame({ appid: 2, genres: ['rpg'] }),
      makeGame({ appid: 3, genres: ['rpg'] }),
    ];
    const result = rankCandidates(games, makeContext(), {
      exclude: noExclude,
      random: constantRandom(0),
    });
    expect(appids(result)).toEqual([2, 3, 1]);
  });

  it('random = () => 0.999 не меняет порядок равных по приоритету игр', () => {
    const games = [
      makeGame({ appid: 1, genres: ['rpg'] }),
      makeGame({ appid: 2, genres: ['rpg'] }),
      makeGame({ appid: 3, genres: ['rpg'] }),
    ];
    const result = rankCandidates(games, makeContext(), {
      exclude: noExclude,
      random: constantRandom(0.999),
    });
    expect(appids(result)).toEqual([1, 2, 3]);
  });

  it('не мутирует исходный массив', () => {
    const games = [
      makeGame({ appid: 1, genres: ['rpg'] }),
      makeGame({ appid: 2, genres: ['rpg'] }),
    ];
    const snapshot = games.map((game) => ({ ...game }));
    rankCandidates(games, makeContext(), { exclude: noExclude, random: constantRandom(0) });
    expect(games).toEqual(snapshot);
  });
});

describe('pickGame', () => {
  it('возвращает null для пустого списка', () => {
    expect(
      pickGame([], makeContext(), { exclude: noExclude, random: constantRandom(0.5) }),
    ).toBeNull();
  });

  it('возвращает null, если ни одна игра не подходит под контекст', () => {
    const games = [makeGame({ appid: 1, genres: ['action'] })];
    expect(
      pickGame(games, makeContext(), { exclude: noExclude, random: constantRandom(0.5) }),
    ).toBeNull();
  });

  it('возвращает null, если все кандидаты исключены', () => {
    const games = [
      makeGame({ appid: 1, genres: ['rpg'] }),
      makeGame({ appid: 2, genres: ['rpg'] }),
    ];
    const result = pickGame(games, makeContext(), {
      exclude: new Set([1, 2]),
      random: constantRandom(0.5),
    });
    expect(result).toBeNull();
  });

  it('единственный кандидат возвращается при любом значении random', () => {
    const only = makeGame({ appid: 7, name: 'Единственная', genres: ['rpg'] });
    for (const value of [0, 0.5, 0.9999]) {
      const result = pickGame([only], makeContext(), {
        exclude: noExclude,
        random: constantRandom(value),
      });
      expect(result?.appid).toBe(7);
    }
  });

  it('учитывает лимит времени из контекста', () => {
    const longGame = makeGame({ appid: 1, genres: ['rpg'], playtimeMinutes: 600 });
    const shortGame = makeGame({ appid: 2, genres: ['rpg'], playtimeMinutes: 10 });
    const context = makeContext({ maxPlaytimeMinutes: 60 });
    const result = pickGame([longGame, shortGame], context, {
      exclude: noExclude,
      random: constantRandom(0),
    });
    expect(result?.appid).toBe(2);
  });

  it('не предлагает отложенную игру, даже если у неё лучший приоритет', () => {
    const fresh = makeGame({ appid: 1, name: 'Не запускал', genres: ['rpg'], playtimeMinutes: 0 });
    const played = makeGame({ appid: 2, name: 'Играл', genres: ['rpg'], playtimeMinutes: 300 });
    const result = pickGame([fresh, played], makeContext(), {
      exclude: new Set([1]),
      random: constantRandom(0),
    });
    expect(result?.appid).toBe(2);
  });

  it('выбирает только из топ-10 кандидатов', () => {
    const many: Game[] = [
      makeGame({ appid: 1, name: 'Не запускал', genres: ['rpg'], playtimeMinutes: 0 }),
      ...Array.from({ length: 11 }, (_, index) =>
        makeGame({
          appid: index + 2,
          name: `Игра ${index + 2}`,
          genres: ['rpg'],
          playtimeMinutes: 300,
        }),
      ),
    ];
    const options = { exclude: noExclude, random: constantRandom(0.999) };
    const ranked = rankCandidates(many, makeContext(), options);
    expect(appids(ranked)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    const top = ranked.slice(0, TOP_CANDIDATES);
    expect(top).toHaveLength(TOP_CANDIDATES);
    expect(appids(top)).not.toContain(11);

    const picked = pickGame(many, makeContext(), options);
    expect(picked?.appid).toBe(10);
    expect(appids(top)).toContain(picked?.appid);
  });

  it('при разных random возвращает игру только из топа кандидатов', () => {
    const many: Game[] = [
      makeGame({ appid: 1, genres: ['rpg'], playtimeMinutes: 0 }),
      ...Array.from({ length: 11 }, (_, index) =>
        makeGame({ appid: index + 2, genres: ['rpg'], playtimeMinutes: 300 }),
      ),
    ];
    for (const value of [0, 0.1, 0.25, 0.5, 0.75, 0.99]) {
      const options = { exclude: noExclude, random: constantRandom(value) };
      const picked = pickGame(many, makeContext(), options);
      const top = rankCandidates(many, makeContext(), options).slice(0, TOP_CANDIDATES);
      expect(picked).not.toBeNull();
      expect(appids(top)).toContain(picked?.appid);
    }
  });

  it('детерминирован для одного зерна seededRandom', () => {
    const games: Game[] = Array.from({ length: 8 }, (_, index) =>
      makeGame({
        appid: index + 1,
        genres: ['rpg'],
        playtimeMinutes: index * 45,
      }),
    );
    const first = pickGame(games, makeContext(), {
      exclude: noExclude,
      random: seededRandom(0.5),
    });
    const second = pickGame(games, makeContext(), {
      exclude: noExclude,
      random: seededRandom(0.5),
    });
    expect(first).not.toBeNull();
    expect(second?.appid).toBe(first?.appid);
  });
});
