import type { Game } from '@/features/backlog/types/Game';
import type { GameFilters } from '@/features/backlog/utils/filterGames';
import {
  collectGenres,
  filterAndSortGames,
  normalizeForSearch,
  SORT_OPTIONS,
} from '@/features/backlog/utils/filterGames';

import { makeGame } from './fixtures/game';

const filters = (overrides: Partial<GameFilters> = {}): GameFilters => ({
  query: '',
  genres: [],
  sort: 'name',
  ...overrides,
});

const appids = (games: readonly Game[]): number[] => games.map((game) => game.appid);

const witcher = makeGame({
  appid: 1,
  name: 'The Witcher® 3™',
  genres: ['rpg', 'adventure'],
  playtimeMinutes: 600,
  addedAt: '2026-01-01T00:00:00.000Z',
  lastPlayedAt: '2026-05-01T00:00:00.000Z',
});
const hades = makeGame({
  appid: 2,
  name: 'Hades',
  genres: ['roguelike', 'action'],
  playtimeMinutes: 120,
  addedAt: '2026-02-01T00:00:00.000Z',
  lastPlayedAt: '2026-06-01T00:00:00.000Z',
});
const elka = makeGame({
  appid: 3,
  name: 'Ёлка',
  genres: ['puzzle'],
  playtimeMinutes: 0,
  addedAt: '2026-03-01T00:00:00.000Z',
  lastPlayedAt: null,
});

const backlog: readonly Game[] = [witcher, hades, elka];

describe('normalizeForSearch', () => {
  it('приводит к нижнему регистру и схлопывает пробелы', () => {
    expect(normalizeForSearch('  THE   Witcher  ')).toBe('the witcher');
  });

  it('убирает ™, ® и ©', () => {
    expect(normalizeForSearch('The Witcher® 3™')).toBe('the witcher 3');
    expect(normalizeForSearch('© 2026 Игра')).toBe('2026 игра');
  });

  it('приравнивает «ё» к «е»', () => {
    expect(normalizeForSearch('Ёлка')).toBe('елка');
    expect(normalizeForSearch('ЕЖИК')).toBe('ежик');
  });

  it('возвращает пустую строку для пустого и пробельного ввода', () => {
    expect(normalizeForSearch('')).toBe('');
    expect(normalizeForSearch('   \n\t ')).toBe('');
  });
});

describe('filterAndSortGames: поиск', () => {
  it('пустой список даёт пустой результат', () => {
    expect(filterAndSortGames([], filters())).toEqual([]);
  });

  it('без фильтров возвращает все игры', () => {
    expect(appids(filterAndSortGames(backlog, filters())).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('ищет по названию без учёта регистра', () => {
    expect(appids(filterAndSortGames(backlog, filters({ query: 'hades' })))).toEqual([2]);
    expect(appids(filterAndSortGames(backlog, filters({ query: 'HADES' })))).toEqual([2]);
  });

  it('находит игру по части названия с «ё»', () => {
    expect(appids(filterAndSortGames(backlog, filters({ query: 'елка' })))).toEqual([3]);
    expect(appids(filterAndSortGames(backlog, filters({ query: 'ЁЛКА' })))).toEqual([3]);
  });

  it('игнорирует ™ и ® в запросе', () => {
    expect(appids(filterAndSortGames(backlog, filters({ query: 'witcher 3™' })))).toEqual([1]);
  });

  it('санитизирует запрос: пробелы и управляющие символы не мешают', () => {
    expect(appids(filterAndSortGames(backlog, filters({ query: '  the\n\twitcher  ' })))).toEqual([
      1,
    ]);
  });

  it('пробельный запрос не фильтрует список', () => {
    expect(
      appids(filterAndSortGames(backlog, filters({ query: '   ' }))).sort((a, b) => a - b),
    ).toEqual([1, 2, 3]);
  });

  it('возвращает пустой список, если ничего не нашлось', () => {
    expect(filterAndSortGames(backlog, filters({ query: 'zzz' }))).toEqual([]);
  });
});

describe('filterAndSortGames: фильтр по жанрам', () => {
  it('пустой список жанров — фильтра нет', () => {
    expect(filterAndSortGames(backlog, filters({ genres: [] }))).toHaveLength(3);
  });

  it('подходит игра хотя бы с одним выбранным жанром', () => {
    expect(appids(filterAndSortGames(backlog, filters({ genres: ['action'] })))).toEqual([2]);
  });

  it('жанры работают как «И»: нужны все выбранные', () => {
    expect(appids(filterAndSortGames(backlog, filters({ genres: ['rpg', 'adventure'] })))).toEqual([
      1,
    ]);
    expect(filterAndSortGames(backlog, filters({ genres: ['rpg', 'puzzle'] }))).toEqual([]);
  });

  it('поиск и жанры применяются вместе', () => {
    expect(
      appids(filterAndSortGames(backlog, filters({ query: 'the', genres: ['rpg', 'adventure'] }))),
    ).toEqual([1]);
  });
});

describe('filterAndSortGames: сортировка', () => {
  it('по названию, числовые части сравниваются как числа', () => {
    const games: Game[] = [
      makeGame({ appid: 11, name: 'Игра 10' }),
      makeGame({ appid: 12, name: 'Игра 2' }),
      makeGame({ appid: 13, name: 'Игра 1' }),
    ];
    expect(appids(filterAndSortGames(games, filters({ sort: 'name' })))).toEqual([13, 12, 11]);
  });

  it('по времени игры: меньше и больше всего, при равенстве — по названию', () => {
    const games: Game[] = [
      makeGame({ appid: 21, name: 'Бета', playtimeMinutes: 60 }),
      makeGame({ appid: 22, name: 'Альфа', playtimeMinutes: 60 }),
      makeGame({ appid: 23, name: 'Гамма', playtimeMinutes: 10 }),
    ];
    expect(appids(filterAndSortGames(games, filters({ sort: 'playtime_asc' })))).toEqual([
      23, 22, 21,
    ]);
    expect(appids(filterAndSortGames(games, filters({ sort: 'playtime_desc' })))).toEqual([
      22, 21, 23,
    ]);
  });

  it('по последнему запуску: новые сверху, не запускавшиеся — в конце', () => {
    const games: Game[] = [
      makeGame({ appid: 31, name: 'Без запусков', lastPlayedAt: null }),
      makeGame({ appid: 32, name: 'Старая', lastPlayedAt: '2025-01-01T00:00:00.000Z' }),
      makeGame({ appid: 33, name: 'Новая', lastPlayedAt: '2026-05-01T00:00:00.000Z' }),
      makeGame({ appid: 34, name: 'Тоже новая', lastPlayedAt: '2026-05-01T00:00:00.000Z' }),
    ];
    expect(appids(filterAndSortGames(games, filters({ sort: 'last_played_desc' })))).toEqual([
      33, 34, 32, 31,
    ]);
  });

  it('по дате добавления: сначала новые, при равных датах — по названию', () => {
    const games: Game[] = [
      makeGame({ appid: 41, name: 'Бета', addedAt: '2026-05-01T00:00:00.000Z' }),
      makeGame({ appid: 42, name: 'Альфа', addedAt: '2026-05-01T00:00:00.000Z' }),
      makeGame({ appid: 43, name: 'Старая', addedAt: '2025-01-01T00:00:00.000Z' }),
    ];
    expect(appids(filterAndSortGames(games, filters({ sort: 'added_desc' })))).toEqual([
      42, 41, 43,
    ]);
  });

  it('не мутирует исходный массив и возвращает новый', () => {
    const games: Game[] = [makeGame({ appid: 51, name: 'Б' }), makeGame({ appid: 52, name: 'А' })];
    const snapshot = games.map((game) => ({ ...game }));
    const result = filterAndSortGames(games, filters({ sort: 'name' }));
    expect(result).not.toBe(games);
    expect(games).toEqual(snapshot);
    expect(appids(result)).toEqual([52, 51]);
  });
});

describe('collectGenres', () => {
  it('считает жанры и сортирует от частых к редким, при равенстве — по алфавиту', () => {
    const games: Game[] = [
      makeGame({ appid: 1, genres: ['rpg', 'action'] }),
      makeGame({ appid: 2, genres: ['rpg'] }),
      makeGame({ appid: 3, genres: ['puzzle', 'rpg'] }),
    ];
    expect(collectGenres(games)).toEqual([
      { genre: 'rpg', count: 3 },
      { genre: 'action', count: 1 },
      { genre: 'puzzle', count: 1 },
    ]);
  });

  it('для пустого списка возвращает пустой массив', () => {
    expect(collectGenres([])).toEqual([]);
  });

  it('игры без жанров не добавляют вариантов', () => {
    expect(collectGenres([makeGame({ appid: 1, genres: [] })])).toEqual([]);
  });
});

describe('SORT_OPTIONS', () => {
  it('содержит все пять вариантов сортировки без дублей и с подписями', () => {
    expect(SORT_OPTIONS.map((option) => option.value)).toEqual([
      'name',
      'last_played_desc',
      'playtime_asc',
      'playtime_desc',
      'added_desc',
    ]);
    expect(new Set(SORT_OPTIONS.map((option) => option.value)).size).toBe(SORT_OPTIONS.length);
    for (const option of SORT_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });
});
