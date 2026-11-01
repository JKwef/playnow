import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';

import { createBacklogCache, type BacklogCache } from '../services/backlogCache';
import { backlogErrorCode, backlogErrorMessage } from '../services/backlogErrors';
import { getSteamLibrary } from '../services/defaultSteamLibrary';
import type { SteamLibraryService } from '../services/steamApi';
import type { BacklogErrorCode, BacklogSnapshot, Game } from '../types/Game';

export const backlogKeys = {
  remote: (steamId: string) => ['backlog', 'remote', steamId] as const,
  cache: (steamId: string) => ['backlog', 'cache', steamId] as const,
};

/** Как часто без ручного «Обновить» перезапрашивать Steam при открытии приложения. */
const REMOTE_STALE_MS = 6 * 60 * 60 * 1000;

export interface BacklogDeps {
  library: () => SteamLibraryService;
  cache: BacklogCache;
}

const defaultDeps: BacklogDeps = { library: getSteamLibrary, cache: createBacklogCache() };

export type BacklogStatus =
  /** Ни кэша, ни ответа сети ещё нет. */
  | 'loading'
  /** Есть список игр (из сети или из кэша). */
  | 'ready'
  /** Списка нет, и загрузить его не удалось. */
  | 'error';

export interface UseBacklogResult {
  status: BacklogStatus;
  games: Game[] | undefined;
  /** Когда список последний раз получен из Steam (ISO). */
  updatedAt: string | null;
  /** Показан кэш, а не свежий ответ сети (например, оффлайн, NFR2.1). */
  isFromCache: boolean;
  isRefreshing: boolean;
  /** Ошибка последней загрузки из сети (даже если показан кэш). */
  errorCode: BacklogErrorCode | null;
  errorMessage: string | null;
  /** Ручное обновление (FR2.5). */
  refresh: () => Promise<void>;
}

/**
 * Бэклог текущего пользователя.
 *
 * Два источника: кэш AsyncStorage (мгновенно, работает оффлайн) и Steam через Edge Function.
 * Пока сеть отвечает, показываем кэш; ответ сети заменяет его и перезаписывает кэш.
 * Если сети нет — остаёмся на кэше и отдаём errorCode 'network' (NFR2.1, NFR2.2).
 */
export const useBacklog = (deps: BacklogDeps = defaultDeps): UseBacklogResult => {
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const signOut = useAuth((state) => state.signOut);
  const queryClient = useQueryClient();
  const { library, cache } = deps;

  const cached = useQuery({
    queryKey: backlogKeys.cache(steamId ?? ''),
    queryFn: () => cache.read(steamId ?? ''),
    enabled: steamId !== null,
    staleTime: Infinity,
  });

  const remote = useQuery({
    queryKey: backlogKeys.remote(steamId ?? ''),
    queryFn: async (): Promise<BacklogSnapshot> => {
      const snapshot = await library().fetchLibrary();
      try {
        await cache.write(steamId ?? '', snapshot);
        queryClient.setQueryData(backlogKeys.cache(steamId ?? ''), snapshot);
      } catch (error) {
        // Не смогли сохранить кэш (например, нет места) — свежие данные всё равно показываем.
        console.warn('backlog cache write failed', error);
      }
      return snapshot;
    },
    enabled: steamId !== null,
    staleTime: REMOTE_STALE_MS,
    // Повторять имеет смысл только временные сбои; приватный профиль от повтора не откроется.
    retry: (failureCount, error) => {
      const code = backlogErrorCode(error);
      return (code === 'steam_unavailable' || code === 'server') && failureCount < 1;
    },
  });

  const errorCode = remote.error ? backlogErrorCode(remote.error) : null;

  // Сессию отозвали или она протухла насовсем: возвращаем на экран входа (FR1.5).
  useEffect(() => {
    if (errorCode === 'unauthorized') {
      void signOut();
    }
  }, [errorCode, signOut]);

  const refresh = useCallback(async () => {
    await remote.refetch();
  }, [remote]);

  return useMemo(() => {
    const snapshot = remote.data ?? cached.data ?? undefined;
    const isLoading = snapshot === undefined && (remote.isPending || cached.isPending);
    let status: BacklogStatus = 'ready';
    if (snapshot === undefined) status = isLoading && errorCode === null ? 'loading' : 'error';
    return {
      status,
      games: snapshot?.games,
      updatedAt: snapshot?.updatedAt ?? null,
      isFromCache: remote.data === undefined && cached.data !== undefined && cached.data !== null,
      isRefreshing: remote.isFetching,
      errorCode,
      errorMessage: remote.error ? backlogErrorMessage(remote.error) : null,
      refresh,
    };
  }, [
    remote.data,
    remote.isPending,
    remote.isFetching,
    remote.error,
    cached.data,
    cached.isPending,
    errorCode,
    refresh,
  ]);
};
