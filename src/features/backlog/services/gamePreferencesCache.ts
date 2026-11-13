import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountRevision, queueAccountWrite } from '@/shared/services/accountScope';

import type { GamePreference, GamePreferences } from '../types/GamePreference';
import type { CacheStorage } from './backlogCache';
import { parsePreference } from './gamePreferences';

export interface GamePreferencesCache {
  read: (steamId: string) => Promise<GamePreferences | null>;
  write: (steamId: string, preferences: GamePreferences) => Promise<void>;
}
const keyFor = (steamId: string) => `playnow:preferences:v1:${steamId}`;

export const createGamePreferencesCache = (
  storage: CacheStorage = AsyncStorage,
): GamePreferencesCache => ({
  read: async (steamId) => {
    const raw = await storage.getItem(keyFor(steamId));
    if (raw === null) return null;
    try {
      const rows: unknown = JSON.parse(raw);
      if (!Array.isArray(rows)) return null;
      const result = new Map<number, GamePreference>();
      for (const row of rows) {
        const parsed = parsePreference(row);
        if (!parsed || result.has(parsed[0])) return null;
        result.set(...parsed);
      }
      return result;
    } catch {
      return null;
    }
  },
  write: async (steamId, preferences) => {
    const revision = accountRevision(steamId);
    await queueAccountWrite(steamId, async () => {
      if (accountRevision(steamId) !== revision) return;
      await storage.setItem(
        keyFor(steamId),
        JSON.stringify(
          [...preferences].map(([appid, value]) => ({
            appid,
            progress_status: value.progressStatus,
            excluded: value.excluded,
          })),
        ),
      );
    });
  },
});
