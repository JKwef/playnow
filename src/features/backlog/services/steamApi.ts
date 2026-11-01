import { BacklogError, type BacklogSnapshot } from '../types/Game';
import { callFunction, type FunctionsClientDeps } from './functionsClient';
import { parseGameRows } from './parseGames';

export interface SteamLibraryDeps extends FunctionsClientDeps {
  now?: () => Date;
}

export interface SteamLibraryService {
  /** Импорт библиотеки Steam через Edge Function steam-library (ключ Steam не на клиенте). */
  fetchLibrary: () => Promise<BacklogSnapshot>;
}

export const createSteamLibraryService = (deps: SteamLibraryDeps): SteamLibraryService => ({
  fetchLibrary: async () => {
    const body = await callFunction(deps, 'steam-library');
    const games = parseGameRows(body.games);
    if (games === null) {
      throw new BacklogError('server', 'Неожиданный формат ответа steam-library');
    }
    return { games, updatedAt: (deps.now?.() ?? new Date()).toISOString() };
  },
});
