import type { Game } from '@/features/backlog/types/Game';
import {
  isBlockedByPreference,
  type GamePreferences,
  type GamePreference,
} from '@/features/backlog/types/GamePreference';

import type { PickerContext, PickerMode } from '../types';

export interface CandidateOptions {
  /** appid, которые не предлагать: отложенные (FR4.4) и уже показанные. */
  exclude: ReadonlySet<number>;
  preferences?: GamePreferences;
  mode?: PickerMode;
  ignoreGenres?: boolean;
  installedOnly?: boolean;
  installedIds?: ReadonlySet<number>;
}
export interface PickOptions extends CandidateOptions {
  random: () => number;
}

/** Genre context never infers session duration from accumulated playtime. */
export const matchesContext = (game: Game, context: PickerContext): boolean =>
  game.genres.some((genre) => context.genres.includes(genre));

/** Explicit status is tier 0, inferred time history tier 1; null is ineligible. */
export const priorityOf = (
  game: Game,
  mode: PickerMode = 'new',
  preference?: GamePreference,
): 0 | 1 | null => {
  if (isBlockedByPreference(preference)) return null;
  const status = preference?.progressStatus ?? 'unspecified';
  if (mode === 'new') {
    if (status === 'not_started') return 0;
    return status === 'unspecified' && game.playtimeMinutes === 0 ? 1 : null;
  }
  if (status === 'playing') return 0;
  return status === 'unspecified' && game.playtimeMinutes > 0 ? 1 : null;
};

/** Exclusions -> genre -> mode. Relaxation changes only the genre step. */
export const filterCandidates = (
  games: readonly Game[],
  context: PickerContext,
  options: CandidateOptions,
): Game[] =>
  games.filter(
    (game) =>
      !options.exclude.has(game.appid) &&
      (!options.installedOnly || options.installedIds?.has(game.appid) === true) &&
      !isBlockedByPreference(options.preferences?.get(game.appid)) &&
      (options.ignoreGenres || matchesContext(game, context)) &&
      priorityOf(game, options.mode, options.preferences?.get(game.appid)) !== null,
  );

/**
 * Кандидаты в порядке приоритета. Внутри одного приоритета порядок случайный:
 * сначала перемешиваем (Фишер–Йетс), потом стабильно сортируем по приоритету.
 * Выбор не ограничивается общим топом из разных групп.
 */
export const rankCandidates = (
  games: readonly Game[],
  context: PickerContext,
  options: PickOptions,
): Game[] => {
  const candidates = filterCandidates(games, context, options);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(options.random() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j] as Game;
    candidates[j] = tmp as Game;
  }
  return candidates.sort(
    (a, b) =>
      priorityOf(a, options.mode, options.preferences?.get(a.appid))! -
      priorityOf(b, options.mode, options.preferences?.get(b.appid))!,
  );
};

/**
 * Случайный выбор только среди кандидатов лучшей доступной группы.
 * null — подходящих игр нет (экран «Нет игр под этот контекст»).
 * Сложность O(n); число кандидатов не ограничивается произвольным топ-10.
 */
export const pickGame = (
  games: readonly Game[],
  context: PickerContext,
  options: PickOptions,
): Game | null => {
  const candidates = filterCandidates(games, context, options);
  const explicit = candidates.filter(
    (game) => priorityOf(game, options.mode, options.preferences?.get(game.appid)) === 0,
  );
  const best = explicit.length > 0 ? explicit : candidates;
  return best.length === 0 ? null : (best[Math.floor(options.random() * best.length)] ?? null);
};
