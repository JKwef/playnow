import { sanitizeSearchQuery } from '@/shared/utils/validation';

import type { Game } from '../types/Game';

/** Варианты сортировки списка (FR3.4). */
export type SortOption = 'name' | 'playtime_asc' | 'playtime_desc' | 'added_desc';

export const SORT_OPTIONS: readonly { value: SortOption; label: string }[] = [
  { value: 'name', label: 'По названию' },
  { value: 'playtime_asc', label: 'Меньше всего играл' },
  { value: 'playtime_desc', label: 'Больше всего играл' },
  { value: 'added_desc', label: 'Сначала новые' },
];

export interface GameFilters {
  /** Сырой текст поиска: санитизация внутри. */
  query: string;
  /** Выбранные жанры. Пустой список — фильтра нет. */
  genres: readonly string[];
  sort: SortOption;
}

/**
 * Приводит название к виду для поиска: без регистра, ™/®, лишних пробелов, «ё» = «е».
 * Без \p{…}: не на всех версиях Hermes есть Unicode property escapes.
 */
export const normalizeForSearch = (text: string): string =>
  text.toLowerCase().replace(/[™®©]/g, '').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

const collator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });
const byName = (a: Game, b: Game): number => collator.compare(a.name, b.name);

const COMPARATORS: Record<SortOption, (a: Game, b: Game) => number> = {
  name: byName,
  playtime_asc: (a, b) => a.playtimeMinutes - b.playtimeMinutes || byName(a, b),
  playtime_desc: (a, b) => b.playtimeMinutes - a.playtimeMinutes || byName(a, b),
  // ISO-строки сравниваются лексикографически так же, как даты.
  added_desc: (a, b) => (a.addedAt < b.addedAt ? 1 : a.addedAt > b.addedAt ? -1 : byName(a, b)),
};

/**
 * Поиск по названию (FR3.2), фильтр по жанрам (FR3.3, игра подходит, если у неё есть
 * хотя бы один из выбранных жанров) и сортировка (FR3.4). Исходный массив не меняется.
 */
export const filterAndSortGames = (games: readonly Game[], filters: GameFilters): Game[] => {
  const needle = normalizeForSearch(sanitizeSearchQuery(filters.query));
  const wanted = new Set(filters.genres);
  const result = games.filter(
    (game) =>
      (needle.length === 0 || normalizeForSearch(game.name).includes(needle)) &&
      (wanted.size === 0 || game.genres.some((genre) => wanted.has(genre))),
  );
  return result.sort(COMPARATORS[filters.sort]);
};

export interface GenreCount {
  genre: string;
  count: number;
}

/** Жанры, которые есть в бэклоге, от частых к редким: варианты для фильтра. */
export const collectGenres = (games: readonly Game[]): GenreCount[] => {
  const counts = new Map<string, number>();
  for (const game of games) {
    for (const genre of game.genres) counts.set(genre, (counts.get(genre) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre));
};
