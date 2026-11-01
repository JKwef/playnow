import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBacklog } from '@/features/backlog/hooks/useBacklog';
import type { Game } from '@/features/backlog/types/Game';
import { newSeed, seededRandom } from '@/shared/utils/random';

import {
  createBlacklistService,
  type Blacklist,
  type BlacklistService,
} from '../services/blacklist';
import type { PickerContext } from '../types';
import { pickGame } from '../utils/pickGame';

const defaultBlacklist = createBlacklistService();
const EMPTY_BLACKLIST: Blacklist = new Map();

export const blacklistKey = (steamId: string) => ['picker', 'blacklist', steamId] as const;

export type PickerStatus =
  /** Ещё нет бэклога или чёрного списка. */
  | 'loading'
  /** Игра подобрана. */
  | 'ready'
  /** Под контекст ничего не подходит (FR4.2). */
  | 'empty';

export interface UseGamePickerResult {
  status: PickerStatus;
  game: Game | null;
  /** Сколько игр отложено (чтобы объяснить пустой результат). */
  postponedCount: number;
  /** «Другой вариант»: новая игра, не показанная в этой серии (FR4.3). */
  next: () => void;
  /** «Отложить»: игра уходит в чёрный список на 7 дней, сразу подбирается следующая. */
  postpone: () => Promise<void>;
  /** true, если других подходящих игр больше нет и «Другой вариант» вернёт ту же. */
  isLastOption: boolean;
}

/**
 * Подбор игры по контексту (FR4.2–FR4.4). Работает на кэшированном бэклоге, значит и оффлайн
 * (NFR2.3). Случайность — из зерна в состоянии: рендер чистый, а новое зерно появляется
 * только по нажатию кнопки.
 */
export const useGamePicker = (
  context: PickerContext,
  blacklistService: BlacklistService = defaultBlacklist,
): UseGamePickerResult => {
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const { games } = useBacklog();
  const queryClient = useQueryClient();
  const [seed, setSeed] = useState(newSeed);
  /** Показанные в этой серии игры: «Другой вариант» не возвращается к ним. */
  const [shown, setShown] = useState<readonly number[]>([]);

  const blacklist = useQuery({
    queryKey: blacklistKey(steamId ?? ''),
    queryFn: () => blacklistService.read(steamId ?? ''),
    enabled: steamId !== null,
    staleTime: Infinity,
  });
  const postponed = blacklist.data ?? EMPTY_BLACKLIST;

  const pickWith = useCallback(
    (exclude: readonly number[], pickSeed: number): Game | null =>
      games === undefined
        ? null
        : pickGame(games, context, {
            exclude: new Set([...postponed.keys(), ...exclude]),
            random: seededRandom(pickSeed),
          }),
    [games, context, postponed],
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

  const postpone = useCallback(async () => {
    if (game === null || steamId === null) return;
    try {
      const updated = await blacklistService.add(steamId, game.appid);
      queryClient.setQueryData(blacklistKey(steamId), updated);
    } catch (error) {
      // Не смогли записать — хотя бы уберём игру из текущей серии.
      console.warn('blacklist write failed', error);
      setShown((current) => [...current, game.appid]);
    }
    setSeed(newSeed());
  }, [game, steamId, blacklistService, queryClient]);

  let status: PickerStatus = 'ready';
  if (games === undefined || blacklist.isPending) status = 'loading';
  else if (game === null) status = 'empty';

  return {
    status,
    game,
    postponedCount: postponed.size,
    next,
    postpone,
    isLastOption: game !== null && !hasOther,
  };
};
