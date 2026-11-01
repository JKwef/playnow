import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CacheStorage } from '@/features/backlog/services/backlogCache';
import { isRecord } from '@/shared/utils/validation';

/** На сколько дней «Отложить» убирает игру из подбора (FR4.3). */
export const POSTPONE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/** appid → момент (мс), до которого игру не предлагать. */
export type Blacklist = ReadonlyMap<number, number>;

export interface BlacklistService {
  /** Действующие записи: просроченные отбрасываются и удаляются с диска. */
  read: (steamId: string) => Promise<Blacklist>;
  /** Откладывает игру на POSTPONE_DAYS дней. */
  add: (steamId: string, appid: number) => Promise<Blacklist>;
  /** Возвращает игру в подбор раньше срока. */
  remove: (steamId: string, appid: number) => Promise<Blacklist>;
  clear: (steamId: string) => Promise<void>;
}

const keyFor = (steamId: string): string => `playnow:blacklist:v1:${steamId}`;

/**
 * Чёрный список «Отложить» (FR4.4). Хранится локально в AsyncStorage (SEC1 это допускает),
 * отдельно для каждого аккаунта. Подбор работает оффлайн (NFR2.3), поэтому не в Supabase.
 */
export const createBlacklistService = (
  storage: CacheStorage = AsyncStorage,
  now: () => number = Date.now,
): BlacklistService => {
  const load = async (steamId: string): Promise<Map<number, number>> => {
    const result = new Map<number, number>();
    try {
      const raw = await storage.getItem(keyFor(steamId));
      if (raw === null) return result;
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return result;
      const current = now();
      for (const [key, value] of Object.entries(parsed)) {
        const appid = Number(key);
        if (
          Number.isSafeInteger(appid) &&
          appid > 0 &&
          typeof value === 'number' &&
          value > current
        ) {
          result.set(appid, value);
        }
      }
    } catch (error) {
      // Битые данные не должны ломать подбор: считаем, что отложенных игр нет.
      console.warn('blacklist read failed', error);
    }
    return result;
  };

  const save = async (steamId: string, entries: Map<number, number>): Promise<void> => {
    await storage.setItem(keyFor(steamId), JSON.stringify(Object.fromEntries(entries)));
  };

  return {
    read: async (steamId) => {
      const entries = await load(steamId);
      // Сразу переписываем без просроченных, чтобы файл не рос бесконечно.
      await save(steamId, entries).catch((error: unknown) => {
        console.warn('blacklist prune failed', error);
      });
      return entries;
    },
    add: async (steamId, appid) => {
      const entries = await load(steamId);
      entries.set(appid, now() + POSTPONE_DAYS * DAY_MS);
      await save(steamId, entries);
      return entries;
    },
    remove: async (steamId, appid) => {
      const entries = await load(steamId);
      entries.delete(appid);
      await save(steamId, entries);
      return entries;
    },
    clear: async (steamId) => {
      await storage.removeItem(keyFor(steamId));
    },
  };
};
