import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CacheStorage } from '@/features/backlog/services/backlogCache';
import { isRecord } from '@/shared/utils/validation';
import { accountRevision, queueAccountWrite } from '@/shared/services/accountScope';

/** На сколько дней «Отложить» убирает игру из подбора (FR4.3). */
export const POSTPONE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;
export type PostponeDuration = 'tomorrow' | 'week';

export const postponeUntil = (duration: PostponeDuration, now: number): number => {
  if (duration === 'week') return now + POSTPONE_DAYS * DAY_MS;
  if (duration !== 'tomorrow') throw new Error('Invalid postponement duration');
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime();
};

const operations = new Map<string, Promise<unknown>>();
const epochs = new Map<string, number>();

/** appid → момент (мс), до которого игру не предлагать. */
export type Blacklist = ReadonlyMap<number, number>;

export interface BlacklistService {
  /** Действующие записи: просроченные отбрасываются и удаляются с диска. */
  read: (steamId: string) => Promise<Blacklist>;
  /** Откладывает игру на POSTPONE_DAYS дней. */
  add: (steamId: string, appid: number, duration?: PostponeDuration) => Promise<Blacklist>;
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
  now: () => number = () => Date.now(),
): BlacklistService => {
  const load = async (steamId: string): Promise<Map<number, number>> => {
    const result = new Map<number, number>();
    const raw = await storage.getItem(keyFor(steamId));
    if (raw === null) return result;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return result;
      const current = now();
      for (const [key, value] of Object.entries(parsed)) {
        const appid = Number(key);
        if (
          Number.isSafeInteger(appid) &&
          appid > 0 &&
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value > current
        ) {
          result.set(appid, value);
        }
      }
    } catch {
      // Битые данные не должны ломать подбор: считаем, что отложенных игр нет.
      console.warn('blacklist read failed');
    }
    return result;
  };

  // Serialize read-modify-write, while allowing account deletion to invalidate
  // a pending read without waiting for it. Disk writes use the common account queue.
  const transact = (
    steamId: string,
    change?: (entries: Map<number, number>) => void,
  ): Promise<Blacklist> => {
    const revision = accountRevision(steamId);
    const epoch = epochs.get(steamId) ?? 0;
    const active = () =>
      accountRevision(steamId) === revision && (epochs.get(steamId) ?? 0) === epoch;
    const operation = (operations.get(steamId) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        if (!active()) return new Map<number, number>();
        const entries = await load(steamId);
        if (!active()) return entries;
        change?.(entries);
        try {
          await queueAccountWrite(steamId, async () => {
            if (active())
              await storage.setItem(keyFor(steamId), JSON.stringify(Object.fromEntries(entries)));
          });
        } catch (error) {
          if (change) throw error;
          console.warn('blacklist prune failed');
        }
        return entries;
      });
    operations.set(steamId, operation);
    void operation
      .finally(() => {
        if (operations.get(steamId) === operation) operations.delete(steamId);
      })
      .catch(() => undefined);
    return operation;
  };

  return {
    read: (steamId) => transact(steamId),
    add: (steamId, appid, duration = 'week') => {
      if (!Number.isSafeInteger(appid) || appid <= 0)
        return Promise.reject(new Error('Invalid appid'));
      return transact(steamId, (entries) => entries.set(appid, postponeUntil(duration, now())));
    },
    remove: (steamId, appid) =>
      transact(steamId, (entries) => {
        entries.delete(appid);
      }),
    clear: async (steamId) => {
      epochs.set(steamId, (epochs.get(steamId) ?? 0) + 1);
      await queueAccountWrite(steamId, () => storage.removeItem(keyFor(steamId)));
    },
  };
};
