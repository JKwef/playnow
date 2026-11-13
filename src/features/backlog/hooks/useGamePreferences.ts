import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';
import { getSupabase } from '@/shared/services/supabase';

import {
  createGamePreferencesService,
  type GamePreferencesService,
} from '../services/gamePreferences';
import {
  createGamePreferencesCache,
  type GamePreferencesCache,
} from '../services/gamePreferencesCache';
import {
  DEFAULT_PREFERENCE,
  type GamePreferences,
  type PreferencePatch,
} from '../types/GamePreference';

export const preferenceKeys = {
  remote: (steamId: string) => ['preferences', 'remote', steamId] as const,
  cache: (steamId: string) => ['preferences', 'cache', steamId] as const,
};
const EMPTY: GamePreferences = new Map();
const defaultService = createGamePreferencesService(getSupabase);
const defaultCache = createGamePreferencesCache();

export const useGamePreferences = (
  service: GamePreferencesService = defaultService,
  cache: GamePreferencesCache = defaultCache,
) => {
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const revision = accountRevision(steamId ?? '');
  const client = useQueryClient();
  const current = useCallback(
    () =>
      steamId !== null &&
      useAuth.getState().user?.steamId === steamId &&
      accountRevision(steamId) === revision,
    [steamId, revision],
  );
  const cached = useQuery({
    queryKey: preferenceKeys.cache(steamId ?? ''),
    queryFn: () => cache.read(steamId ?? ''),
    enabled: steamId !== null,
    staleTime: Infinity,
    retry: false,
  });
  const remote = useQuery({
    queryKey: preferenceKeys.remote(steamId ?? ''),
    queryFn: async ({ signal }) => {
      if (!current()) throw new Error('Account changed');
      const values = await service.fetch(steamId ?? '', signal);
      signal.throwIfAborted();
      if (!current()) throw new Error('Account changed');
      client.setQueryData(preferenceKeys.cache(steamId ?? ''), values);
      try {
        await cache.write(steamId ?? '', values);
      } catch {
        console.warn('preference cache write failed');
      }
      return values;
    },
    enabled: steamId !== null,
    staleTime: 60_000,
    retry: false,
  });
  const values = remote.data ?? cached.data ?? undefined;
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<{ appid: number; patch: PreferencePatch } | null>(
    null,
  );
  const scope = `${steamId ?? ''}:${revision}`;
  const [actionScope, setActionScope] = useState(scope);
  const busy = useRef(false);

  const persist = useCallback(
    async (appid: number, patch: PreferencePatch, recordUndo: boolean): Promise<boolean> => {
      if (!current() || steamId === null || busy.current || values === undefined) return false;
      busy.current = true;
      setActionScope(scope);
      setIsSaving(true);
      setActionError(null);
      setMessage(null);
      const before = values.get(appid) ?? DEFAULT_PREFERENCE;
      try {
        await client.cancelQueries({ queryKey: preferenceKeys.remote(steamId) });
        if (!current()) return false;
        const saved = await service.save(steamId, appid, patch);
        if (!current()) return false;
        const latest =
          client.getQueryData<GamePreferences>(preferenceKeys.remote(steamId)) ??
          client.getQueryData<GamePreferences | null>(preferenceKeys.cache(steamId)) ??
          values;
        const next = new Map(latest);
        next.set(appid, saved);
        client.setQueryData(preferenceKeys.remote(steamId), next);
        client.setQueryData(preferenceKeys.cache(steamId), next);
        if (recordUndo)
          setLastAction({
            appid,
            patch: {
              ...(patch.progressStatus !== undefined
                ? { progressStatus: before.progressStatus }
                : {}),
              ...(patch.excluded !== undefined ? { excluded: before.excluded } : {}),
            },
          });
        else setLastAction(null);
        try {
          await cache.write(steamId, next);
        } catch {
          if (current())
            setActionError(
              'Изменение сохранено в аккаунте, но кэш на устройстве обновить не удалось.',
            );
        }
        if (!current()) return false;
        setMessage(recordUndo ? 'Изменение сохранено' : 'Изменение отменено');
        return true;
      } catch {
        if (current())
          setActionError(
            'Не удалось сохранить изменение. Проверьте подключение и повторите попытку.',
          );
        return false;
      } finally {
        busy.current = false;
        setIsSaving(false);
      }
    },
    [current, steamId, values, service, cache, client, scope],
  );
  const save = useCallback(
    (appid: number, patch: PreferencePatch) => persist(appid, patch, true),
    [persist],
  );
  const undo = useCallback(
    async () =>
      lastAction && actionScope === scope
        ? persist(lastAction.appid, lastAction.patch, false)
        : false,
    [lastAction, persist, actionScope, scope],
  );
  const retry = useCallback(async () => {
    await remote.refetch({ cancelRefetch: false });
  }, [remote]);
  const isLoading =
    steamId !== null && values === undefined && (remote.isPending || cached.isPending);
  return {
    preferences: values ?? EMPTY,
    hasData: values !== undefined,
    isLoading,
    isUnavailable: steamId !== null && !isLoading && values === undefined,
    isFromCache: values !== undefined && (remote.isError || remote.data === undefined),
    loadError: remote.isError
      ? 'Не удалось обновить статусы и исключения. Проверьте подключение.'
      : null,
    isRefreshing: remote.isFetching,
    isSaving,
    actionError: actionScope === scope ? actionError : null,
    message: actionScope === scope ? message : null,
    canUndo: lastAction !== null && actionScope === scope,
    save,
    undo,
    retry,
  };
};
