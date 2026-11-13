import { useCallback, useMemo, useState } from 'react';

import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import { useGamePreferences } from '@/features/backlog/hooks/useGamePreferences';
import { isBlockedByPreference } from '@/features/backlog/types/GamePreference';
import type { BacklogErrorCode, Game } from '@/features/backlog/types/Game';
import { newSeed, seededRandom } from '@/shared/utils/random';

import type { BlacklistService, PostponeDuration } from '../services/blacklist';
import type { PickerContext } from '../types';
import { pickGame } from '../utils/pickGame';
import { useBlacklist } from './useBlacklist';

export type PickerStatus =
  /** Ещё нет бэклога или чёрного списка. */
  | 'loading'
  /** Игра подобрана. */
  | 'ready'
  /** Под контекст ничего не подходит (FR4.2). */
  | 'empty'
  /** Бэклог не загрузился: подбирать не из чего. */
  | 'error';

export interface UseGamePickerResult {
  status: PickerStatus;
  game: Game | null;
  /** Сколько игр отложено (чтобы объяснить пустой результат). */
  postponedCount: number;
  excludedCount: number;
  /** «Другой вариант»: новая игра, не показанная в этой серии (FR4.3). */
  next: () => void;
  /** После подтверждённого откладывания подбирается следующая игра. */
  postpone: (duration?: PostponeDuration) => Promise<boolean>;
  actionError: string | null;
  /** true, если других подходящих игр больше нет и «Другой вариант» вернёт ту же. */
  isLastOption: boolean;
  /** Ошибка загрузки бэклога (код и текст для BacklogErrorView). */
  errorCode: BacklogErrorCode | null;
  errorMessage: string | null;
  /** Идёт повторная загрузка бэклога после ошибки. */
  isRetrying: boolean;
  /** Повторить загрузку бэклога. */
  refresh: () => Promise<void>;
}

/**
 * Подбор игры по контексту (FR4.2–FR4.4). Работает на кэшированном бэклоге, значит и оффлайн
 * (NFR2.3). Случайность — из зерна в состоянии: рендер чистый, а новое зерно появляется
 * только по нажатию кнопки.
 */
export const useGamePicker = (
  context: PickerContext,
  blacklistService?: BlacklistService,
): UseGamePickerResult => {
  const backlog = useBacklog();
  const { games } = backlog;
  const preferences = useGamePreferences();
  const blacklist = useBlacklist(blacklistService);
  const postponed = blacklist.postponed;
  const [seed, setSeed] = useState(newSeed);
  /** Показанные в этой серии игры: «Другой вариант» не возвращается к ним. */
  const [shown, setShown] = useState<readonly number[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const pickWith = useCallback(
    (exclude: readonly number[], pickSeed: number): Game | null =>
      games === undefined
        ? null
        : pickGame(games, context, {
            exclude: new Set([...postponed.keys(), ...exclude]),
            random: seededRandom(pickSeed),
            preferences: preferences.preferences,
          }),
    [games, context, postponed, preferences.preferences],
  );

  const game = useMemo(() => pickWith(shown, seed), [pickWith, shown, seed]);
  // Есть ли что-то ещё, кроме текущей игры и уже показанных/хотя бы кроме текущей.
  const hasOther = useMemo(
    () => game !== null && pickWith([game.appid], seed) !== null,
    [game, pickWith, seed],
  );

  const next = useCallback(() => {
    if (game === null || !hasOther) return;
    const nextSeed = newSeed();
    const withCurrent = [...shown, game.appid];
    // Все подходящие уже показаны — начинаем серию заново, исключая только текущую.
    setShown(pickWith(withCurrent, nextSeed) !== null ? withCurrent : [game.appid]);
    setSeed(nextSeed);
  }, [game, hasOther, shown, pickWith]);

  const { postpone: addToBlacklist } = blacklist;
  const postpone = useCallback(
    async (duration?: PostponeDuration) => {
      if (game === null) return false;
      setActionError(null);
      try {
        await addToBlacklist(game.appid, duration);
      } catch {
        setActionError('Не удалось отложить игру. Попробуйте ещё раз.');
        return false;
      }
      setSeed(newSeed());
      return true;
    },
    [game, addToBlacklist],
  );

  let status: PickerStatus = 'ready';
  if (backlog.status === 'error') status = 'error';
  else if (preferences.isUnavailable || blacklist.errorMessage) status = 'error';
  else if (games === undefined || blacklist.isLoading || preferences.isLoading) status = 'loading';
  else if (game === null) status = 'empty';

  return {
    status,
    game,
    postponedCount: postponed.size,
    excludedCount: (games ?? []).filter((item) =>
      isBlockedByPreference(preferences.preferences.get(item.appid)),
    ).length,
    next,
    postpone,
    actionError,
    isLastOption: game !== null && !hasOther,
    errorCode: preferences.isUnavailable || blacklist.errorMessage ? 'server' : backlog.errorCode,
    errorMessage: preferences.isUnavailable
      ? preferences.loadError
      : (blacklist.errorMessage ?? backlog.errorMessage),
    isRetrying: backlog.isRefreshing || preferences.isRefreshing,
    refresh: preferences.isUnavailable
      ? preferences.retry
      : blacklist.errorMessage
        ? blacklist.retry
        : backlog.refresh,
  };
};
