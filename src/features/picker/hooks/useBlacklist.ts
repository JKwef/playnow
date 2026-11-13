import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';

import {
  createBlacklistService,
  type Blacklist,
  type BlacklistService,
  type PostponeDuration,
} from '../services/blacklist';

const defaultService = createBlacklistService();
const EMPTY: Blacklist = new Map();

export const blacklistKey = (steamId: string) => ['picker', 'blacklist', steamId] as const;

export interface UseBlacklistResult {
  /** appid → момент (мс), до которого игра отложена. */
  postponed: Blacklist;
  isLoading: boolean;
  postpone: (appid: number, duration?: PostponeDuration) => Promise<void>;
  /** «Вернуть в подбор» раньше срока. */
  restore: (appid: number) => Promise<void>;
  errorMessage: string | null;
  retry: () => Promise<void>;
}

/** Отложенные игры текущего аккаунта (FR4.4). Общий кэш react-query для всех экранов. */
export const useBlacklist = (service: BlacklistService = defaultService): UseBlacklistResult => {
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: blacklistKey(steamId ?? ''),
    queryFn: () => service.read(steamId ?? ''),
    enabled: steamId !== null,
    staleTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (steamId === null || !query.data) return;
    const key = blacklistKey(steamId);
    const prune = () =>
      queryClient.setQueryData<Blacklist>(key, (previous) => {
        if (!previous) return previous;
        const next = new Map([...previous].filter(([, until]) => until > Date.now()));
        return next.size === previous.size ? previous : next;
      });
    const until = Math.min(...query.data.values());
    const timer = Number.isFinite(until)
      ? setTimeout(prune, Math.min(2_147_483_647, Math.max(0, until - Date.now())))
      : null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') prune();
    });
    return () => {
      if (timer !== null) clearTimeout(timer);
      subscription.remove();
    };
  }, [steamId, query.data, queryClient]);

  const postpone = useCallback(
    async (appid: number, duration?: PostponeDuration) => {
      if (steamId === null) return;
      const revision = accountRevision(steamId);
      const entries = await service.add(steamId, appid, duration);
      if (useAuth.getState().user?.steamId === steamId && accountRevision(steamId) === revision)
        queryClient.setQueryData(blacklistKey(steamId), entries);
    },
    [steamId, service, queryClient],
  );

  const restore = useCallback(
    async (appid: number) => {
      if (steamId === null) return;
      const revision = accountRevision(steamId);
      const entries = await service.remove(steamId, appid);
      if (useAuth.getState().user?.steamId === steamId && accountRevision(steamId) === revision)
        queryClient.setQueryData(blacklistKey(steamId), entries);
    },
    [steamId, service, queryClient],
  );

  const retry = useCallback(async () => {
    await query.refetch();
  }, [query]);
  return {
    postponed: query.data ?? EMPTY,
    isLoading: steamId !== null && query.isPending,
    postpone,
    restore,
    errorMessage: query.isError
      ? 'Не удалось прочитать отложенные игры. Повторите загрузку.'
      : null,
    retry,
  };
};
