import { BacklogError, type BacklogSnapshot } from '../types/Game';
import { callFunction, type FunctionsClientDeps } from './functionsClient';
import { parseGameRows } from './parseGames';
import { asNonNegativeInt } from '@/shared/utils/validation';

export interface SteamLibraryDeps extends FunctionsClientDeps {
  now?: () => Date;
}

export interface SteamLibraryService {
  /** Импорт библиотеки Steam через Edge Function steam-library (ключ Steam не на клиенте). */
  fetchLibrary: (signal?: AbortSignal) => Promise<BacklogSnapshot>;
}

export const createSteamLibraryService = (deps: SteamLibraryDeps): SteamLibraryService => ({
  fetchLibrary: async (signal) => {
    const body = await callFunction(deps, 'steam-library', signal);
    const games = parseGameRows(body.games);
    if (games === null) {
      throw new BacklogError('server', 'Неожиданный формат ответа steam-library');
    }
    const remaining = asNonNegativeInt(body.remaining);
    return {
      games,
      updatedAt: (deps.now?.() ?? new Date()).toISOString(),
      ...(remaining !== null ? { metadataRemaining: remaining } : {}),
    };
  },
});
