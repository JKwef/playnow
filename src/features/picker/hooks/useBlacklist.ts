import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';

import {
  createBlacklistService,
  type Blacklist,
  type BlacklistService,
} from '../services/blacklist';

const defaultService = createBlacklistService();
const EMPTY: Blacklist = new Map();

export const blacklistKey = (steamId: string) => ['picker', 'blacklist', steamId] as const;

export interface UseBlacklistResult {
  /** appid → момент (мс), до которого игра отложена. */
  postponed: Blacklist;
  isLoading: boolean;
  postpone: (appid: number) => Promise<void>;
  /** «Вернуть в подбор» раньше срока. */
  restore: (appid: number) => Promise<void>;
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
  });

  const postpone = useCallback(
    async (appid: number) => {
      if (steamId === null) return;
      queryClient.setQueryData(blacklistKey(steamId), await service.add(steamId, appid));
    },
    [steamId, service, queryClient],
  );

  const restore = useCallback(
    async (appid: number) => {
      if (steamId === null) return;
      queryClient.setQueryData(blacklistKey(steamId), await service.remove(steamId, appid));
    },
    [steamId, service, queryClient],
  );

  return { postponed: query.data ?? EMPTY, isLoading: query.isPending, postpone, restore };
};
