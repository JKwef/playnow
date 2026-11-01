import { useCallback, useState } from 'react';

import { getManualGames } from '../services/defaultServices';
import {
  manualGameErrorMessage,
  type ManualGameService,
  type NewManualGame,
} from '../services/manualGames';
import { useBacklog } from './useBacklog';

export interface UseAddGameResult {
  isSaving: boolean;
  errorMessage: string | null;
  /** true, если игра сохранена (список уже обновлён). */
  addGame: (game: NewManualGame) => Promise<boolean>;
}

/** Ручное добавление игры (FR2.6). После сохранения перезагружает бэклог: оттуда же придут жанры. */
export const useAddGame = (service: () => ManualGameService = getManualGames): UseAddGameResult => {
  const { games, refresh } = useBacklog();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addGame = useCallback(
    async (game: NewManualGame) => {
      setIsSaving(true);
      setErrorMessage(null);
      try {
        const taken = new Set((games ?? []).map((item) => item.appid));
        await service().addGame(game, taken);
        // Свежий импорт вернёт и ручную игру, и запустит догрузку жанров из RAWG.
        await refresh();
        return true;
      } catch (error) {
        console.warn('manual game add failed', error);
        setErrorMessage(manualGameErrorMessage(error));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [games, refresh, service],
  );

  return { isSaving, errorMessage, addGame };
};
