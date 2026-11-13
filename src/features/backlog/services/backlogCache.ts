import AsyncStorage from '@react-native-async-storage/async-storage';

import { queueAccountWrite } from '@/shared/services/accountScope';

import { asNonNegativeInt, isRecord } from '@/shared/utils/validation';

import type { BacklogSnapshot } from '../types/Game';
import { parseGameRows, toGameRow } from './parseGames';

/** Минимальный интерфейс AsyncStorage: в тестах подменяется Map'ом. */
export interface CacheStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export interface BacklogCache {
  read: (steamId: string) => Promise<BacklogSnapshot | null>;
  write: (steamId: string, snapshot: BacklogSnapshot) => Promise<void>;
  clear: (steamId: string) => Promise<void>;
}

/** Версия формата: при несовместимых изменениях старый кэш просто игнорируется. */
const CACHE_VERSION = 1;
/** Ключ включает steamId: после смены аккаунта чужой бэклог не покажется. */
const keyFor = (steamId: string): string => `playnow:backlog:v${CACHE_VERSION}:${steamId}`;

/**
 * Локальный кэш бэклога (FR2.4, NFR2). AsyncStorage не шифруется — по ТЗ (SEC1) это допустимо,
 * токены здесь не храним. Данные с диска валидируются так же строго, как ответ сети.
 */
export const createBacklogCache = (storage: CacheStorage = AsyncStorage): BacklogCache => ({
  read: async (steamId) => {
    try {
      const raw = await storage.getItem(keyFor(steamId));
      if (raw === null) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed) || parsed.version !== CACHE_VERSION) return null;
      const games = parseGameRows(parsed.games);
      const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null;
      const remaining = asNonNegativeInt(parsed.metadataRemaining);
      return games === null || updatedAt === null
        ? null
        : {
            games,
            updatedAt,
            ...(remaining !== null ? { metadataRemaining: remaining } : {}),
          };
    } catch (error) {
      // Битый кэш не должен ломать запуск: считаем, что его нет.
      console.warn('backlog cache read failed', error);
      return null;
    }
  },
  write: async (steamId, snapshot) => {
    const payload = {
      version: CACHE_VERSION,
      updatedAt: snapshot.updatedAt,
      games: snapshot.games.map(toGameRow),
      ...(snapshot.metadataRemaining !== undefined
        ? { metadataRemaining: snapshot.metadataRemaining }
        : {}),
    };
    await queueAccountWrite(steamId, () =>
      storage.setItem(keyFor(steamId), JSON.stringify(payload)),
    );
  },
  clear: async (steamId) => {
    await queueAccountWrite(steamId, () => storage.removeItem(keyFor(steamId)));
  },
});
