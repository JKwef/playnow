import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { accountRevision } from '@/shared/services/accountScope';

import { createBacklogCache, type BacklogCache } from '../services/backlogCache';
import { getGenreOverrides } from '../services/defaultServices';
import type { GenreOverridesService } from '../services/genreOverrides';
import type { BacklogSnapshot } from '../types/Game';
import { backlogKeys } from './useBacklog';

const defaultCache = createBacklogCache();

export const useGenreOverrides = (
  service: () => GenreOverridesService = getGenreOverrides,
  cache: BacklogCache = defaultCache,
) => {
  const steamId = useAuth((state) => state.user?.steamId ?? null);
  const client = useQueryClient();
  const inFlight = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useCallback(
    async (appid: number, genres: readonly string[] | null): Promise<boolean> => {
      if (!steamId || inFlight.current) return false;
      inFlight.current = true;
      setIsSaving(true);
      setErrorMessage(null);
      setSaved(false);
      const revision = accountRevision(steamId);
      const isCurrent = () =>
        useAuth.getState().user?.steamId === steamId && accountRevision(steamId) === revision;
      try {
        const game = await service().save(appid, steamId, genres);
        if (!isCurrent()) return false;
        const remote = client.getQueryData<BacklogSnapshot>(backlogKeys.remote(steamId));
        const current =
          remote ?? client.getQueryData<BacklogSnapshot | null>(backlogKeys.cache(steamId));
        if (current) {
          const updated = {
            ...current,
            games: current.games.map((item) => (item.appid === appid ? game : item)),
          };
          if (remote) client.setQueryData(backlogKeys.remote(steamId), updated);
          client.setQueryData(backlogKeys.cache(steamId), updated);
          try {
            await cache.write(steamId, updated);
          } catch {
            if (isCurrent())
              setErrorMessage('Жанры сохранены в аккаунте, но локальный кэш обновить не удалось.');
          }
        }
        if (!isCurrent()) return false;
        setSaved(true);
        return true;
      } catch {
        if (isCurrent())
          setErrorMessage(
            'Не удалось сохранить жанры. Для изменения нужно подключение к сети. Попробуйте ещё раз.',
          );
        return false;
      } finally {
        inFlight.current = false;
        setIsSaving(false);
      }
    },
    [steamId, service, cache, client],
  );

  return { save, isSaving, errorMessage, saved };
};
