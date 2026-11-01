import type { Game } from '@/features/backlog/types/Game';

import type { PickerContext } from '../types';

/** Из скольких лучших кандидатов выбираем случайно (FR4.2). */
export const TOP_CANDIDATES = 10;
/** Порог «почти не играл» для второго приоритета (FR4.2). */
export const BARELY_PLAYED_MINUTES = 120;

export interface PickOptions {
  /** appid, которые не предлагать: отложенные (FR4.4) и уже показанные. */
  exclude: ReadonlySet<number>;
  /** Источник случайности [0, 1). В приложении — seededRandom, в тестах — фиксированный. */
  random: () => number;
}

/** Подходит ли игра под контекст: хотя бы один жанр контекста и (если задано) лимит времени. */
export const matchesContext = (game: Game, context: PickerContext): boolean =>
  game.genres.some((genre) => context.genres.includes(genre)) &&
  (context.maxPlaytimeMinutes === undefined || game.playtimeMinutes < context.maxPlaytimeMinutes);

/** Приоритет (меньше — лучше): 0 — ни разу не запускал, 1 — меньше 2 часов, 2 — остальные. */
export const priorityOf = (game: Game): number => {
  if (game.playtimeMinutes === 0) return 0;
  if (game.playtimeMinutes < BARELY_PLAYED_MINUTES) return 1;
  return 2;
};

/**
 * Кандидаты в порядке приоритета. Внутри одного приоритета порядок случайный:
 * сначала перемешиваем (Фишер–Йетс), потом стабильно сортируем по приоритету.
 * Иначе в топ-10 всегда попадали бы одни и те же игры (например, по алфавиту).
 */
export const rankCandidates = (
  games: readonly Game[],
  context: PickerContext,
  { exclude, random }: PickOptions,
): Game[] => {
  const candidates = games.filter(
    (game) => !exclude.has(game.appid) && matchesContext(game, context),
  );
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j] as Game;
    candidates[j] = tmp as Game;
  }
  return candidates.sort((a, b) => priorityOf(a) - priorityOf(b));
};

/**
 * Алгоритм подбора (FR4.2): фильтр по контексту → приоритизация → случайная игра из топ-10.
 * null — подходящих игр нет (экран «Нет игр под этот контекст»).
 * Сложность O(n log n): на 500 играх это доли миллисекунды (NFR1.3).
 */
export const pickGame = (
  games: readonly Game[],
  context: PickerContext,
  options: PickOptions,
): Game | null => {
  const top = rankCandidates(games, context, options).slice(0, TOP_CANDIDATES);
  if (top.length === 0) return null;
  return top[Math.floor(options.random() * top.length)] ?? null;
};
