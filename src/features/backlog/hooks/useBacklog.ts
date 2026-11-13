import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';

import { createBacklogCache, type BacklogCache } from '../services/backlogCache';
import { backlogErrorCode, backlogErrorMessage } from '../services/backlogErrors';
import { getRawgEnrichment, getSteamLibrary } from '../services/defaultServices';
import { mergeGames, runEnrichment, type RawgEnrichmentService } from '../services/rawgApi';
import type { SteamLibraryService } from '../services/steamApi';
import type { BacklogErrorCode, BacklogSnapshot, Game } from '../types/Game';

export const backlogKeys = {
  remote: (steamId: string) => ['backlog', 'remote', steamId] as const,
  cache: (steamId: string) => ['backlog', 'cache', steamId] as const,
  /** Одна загрузка жанров на каждый свежий импорт (updatedAt). */
  enrich: (steamId: string, updatedAt: string) =>
    ['backlog', 'enrich', steamId, updatedAt] as const,
  enrichProgress: (steamId: string) => ['backlog', 'enrichProgress', steamId] as const,
};

/** Как часто без ручного «Обновить» перезапрашивать Steam при открытии приложения. */
const REMOTE_STALE_MS = 6 * 60 * 60 * 1000;

export interface BacklogDeps {
  library: () => SteamLibraryService;
  enrichment: () => RawgEnrichmentService;
  cache: BacklogCache;
}

const defaultDeps: BacklogDeps = {
  library: getSteamLibrary,
  enrichment: getRawgEnrichment,
  cache: createBacklogCache(),
};

export type GenresStatus =
  /** Жанры ещё не загружали (например, показан только кэш оффлайн). */
  | 'idle'
  | 'loading'
  | 'done'
  | 'partial'
  /** RAWG недоступен: у части игр нет жанров, догрузим при следующем обновлении. */
  | 'error';

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
  /** Загрузка жанров из RAWG после импорта (FR2.3). */
  genresStatus: GenresStatus;
  /** Сколько игр ещё ждут жанров (null — неизвестно). */
  genresRemaining: number | null;
  /** Ручное обновление (FR2.5). */
  refresh: () => Promise<void>;
  /** Resume unfinished metadata only; never imports Steam again. */
  retryGenres: () => Promise<void>;
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
  const { library, enrichment, cache } = deps;
  const revision = accountRevision(steamId ?? '');
  const isCurrent = useCallback(
    () =>
      steamId !== null &&
      useAuth.getState().user?.steamId === steamId &&
      accountRevision(steamId) === revision,
    [steamId, revision],
  );

  const saveToCache = useCallback(
    async (snapshot: BacklogSnapshot) => {
      if (!isCurrent()) return;
      queryClient.setQueryData(backlogKeys.cache(steamId ?? ''), snapshot);
      try {
        await cache.write(steamId ?? '', snapshot);
      } catch (error) {
        // Не смогли сохранить кэш (например, нет места) — свежие данные всё равно показываем.
        console.warn('backlog cache write failed', error);
      }
    },
    [cache, queryClient, steamId, isCurrent],
  );

  const cached = useQuery({
    queryKey: backlogKeys.cache(steamId ?? ''),
    queryFn: () => cache.read(steamId ?? ''),
    enabled: steamId !== null,
    staleTime: Infinity,
  });

  const remote = useQuery({
    queryKey: backlogKeys.remote(steamId ?? ''),
    queryFn: async ({ signal }): Promise<BacklogSnapshot> => {
      if (!isCurrent()) throw new Error('Account changed');
      await queryClient.cancelQueries({ queryKey: ['backlog', 'enrich', steamId ?? ''] });
      signal.throwIfAborted();
      const snapshot = await library().fetchLibrary(signal);
      signal.throwIfAborted();
      if (!isCurrent()) throw new Error('Account changed');
      queryClient.setQueryData(
        backlogKeys.enrichProgress(steamId ?? ''),
        snapshot.metadataRemaining ?? null,
      );
      await saveToCache(snapshot);
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

  /*
   * Жанры из RAWG (FR2.3) догружаются партиями после каждого свежего импорта.
   * Это отдельный query, а не эффект: react-query не запустит загрузку дважды,
   * даже если хук смонтирован на двух экранах. Прерванная обработка сохраняет остаток
   * и продолжается отдельным действием без повторного импорта Steam.
   */
  const remoteUpdatedAt = (remote.data ?? cached.data)?.updatedAt ?? null;
  const progressKey = backlogKeys.enrichProgress(steamId ?? '');
  const genres = useQuery({
    queryKey: backlogKeys.enrich(steamId ?? '', remoteUpdatedAt ?? ''),
    queryFn: async ({ signal }): Promise<number> =>
      runEnrichment({
        service: enrichment(),
        signal,
        onBatch: async (batch) => {
          signal.throwIfAborted();
          if (!isCurrent()) throw new Error('Account changed');
          queryClient.setQueryData<number>(progressKey, batch.remaining);
          const currentRemote = queryClient.getQueryData<BacklogSnapshot>(
            backlogKeys.remote(steamId ?? ''),
          );
          const current =
            currentRemote ??
            queryClient.getQueryData<BacklogSnapshot | null>(backlogKeys.cache(steamId ?? ''));
          if (!current) return;
          const merged = {
            ...mergeGames(current, batch.games),
            metadataRemaining: batch.remaining,
          };
          if (currentRemote) queryClient.setQueryData(backlogKeys.remote(steamId ?? ''), merged);
          await saveToCache(merged);
        },
      }),
    enabled:
      steamId !== null &&
      remote.data !== undefined &&
      !remote.isFetching &&
      remote.data.metadataRemaining !== 0,
    staleTime: Infinity,
    // После сбоя пользователь продолжает с последней сохранённой партии.
    retry: false,
  });
  const progress = useQuery<number | null>({
    queryKey: progressKey,
    queryFn: () => null,
    enabled: false,
  });

  useEffect(() => {
    if (genres.error) {
      console.warn('genres enrichment failed', genres.error);
    }
  }, [genres.error]);

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
  const retryGenres = useCallback(async () => {
    if (!isCurrent()) return;
    await genres.refetch({ cancelRefetch: false });
  }, [genres, isCurrent]);

  return useMemo(() => {
    const snapshot = remote.data ?? cached.data ?? undefined;
    const isLoading = snapshot === undefined && (remote.isPending || cached.isPending);
    let status: BacklogStatus = 'ready';
    if (snapshot === undefined) status = isLoading && errorCode === null ? 'loading' : 'error';
    let genresStatus: GenresStatus = 'idle';
    const remaining = progress.data ?? genres.data ?? snapshot?.metadataRemaining ?? null;
    if (genres.isFetching) genresStatus = 'loading';
    else if (genres.isError) genresStatus = 'error';
    else if (remaining === 0) genresStatus = 'done';
    else if (remaining !== null && remaining > 0) genresStatus = 'partial';
    return {
      status,
      games: snapshot?.games,
      updatedAt: snapshot?.updatedAt ?? null,
      isFromCache: snapshot !== undefined && (remote.isError || remote.data === undefined),
      isRefreshing: remote.isFetching,
      errorCode,
      errorMessage: remote.error ? backlogErrorMessage(remote.error) : null,
      genresStatus,
      genresRemaining: remaining,
      refresh,
      retryGenres,
    };
  }, [
    remote.data,
    remote.isPending,
    remote.isFetching,
    remote.error,
    remote.isError,
    cached.data,
    cached.isPending,
    errorCode,
    genres.isFetching,
    genres.isError,
    genres.data,
    progress.data,
    refresh,
    retryGenres,
  ]);
};
