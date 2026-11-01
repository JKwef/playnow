import { useCallback, useMemo, useState } from 'react';

import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

import type { Game } from '../types/Game';
import { collectGenres, filterAndSortGames, type SortOption } from '../utils/filterGames';

/** Задержка поиска в реальном времени (FR3.2). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Состояние поиска, фильтра по жанрам и сортировки для экрана списка (FR3.2–FR3.4). */
export const useGameFilters = (games: readonly Game[]) => {
  const [query, setQuery] = useState('');
  const [genres, setGenres] = useState<readonly string[]>([]);
  const [sort, setSort] = useState<SortOption>('name');
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);

  const toggleGenre = useCallback((genre: string) => {
    setGenres((current) =>
      current.includes(genre) ? current.filter((item) => item !== genre) : [...current, genre],
    );
  }, []);
  const clearGenres = useCallback(() => setGenres([]), []);
  const reset = useCallback(() => {
    setQuery('');
    setGenres([]);
  }, []);

  const visibleGames = useMemo(
    () => filterAndSortGames(games, { query: debouncedQuery, genres, sort }),
    [games, debouncedQuery, genres, sort],
  );
  /*
   * Варианты фильтра считаем по уже отфильтрованному списку: число рядом с жанром —
   * сколько игр останется, если добавить его. Жанры, которые дали бы пустой список,
   * не показываем. Выбранные жанры остаются в списке всегда, чтобы их можно было снять.
   */
  const availableGenres = useMemo(() => {
    const counts = collectGenres(visibleGames);
    const present = new Set(counts.map((item) => item.genre));
    const selectedMissing = genres
      .filter((genre) => !present.has(genre))
      .map((genre) => ({ genre, count: 0 }));
    return [...selectedMissing, ...counts];
  }, [visibleGames, genres]);

  return {
    query,
    setQuery,
    genres,
    toggleGenre,
    clearGenres,
    sort,
    setSort,
    reset,
    visibleGames,
    availableGenres,
    // По отложенному запросу: иначе 300 мс висит «Найдено 500 из 500» до применения поиска.
    hasActiveFilters: debouncedQuery.trim().length > 0 || genres.length > 0,
  };
};
