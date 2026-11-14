import * as SecureStore from 'expo-secure-store';

/**
 * Минимальный интерфейс хранилища, совместимый с `auth.storage` в supabase-js.
 * Вынесен отдельно, чтобы в тестах подставлять in-memory реализацию (DI).
 */
export interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/** Низкоуровневые операции SecureStore; параметр нужен, чтобы мокать их в unit-тестах. */
export interface SecureStoreDriver {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}

/**
 * Лимит в байтах: некоторые версии iOS отклоняли значения больше 2048 байт.
 */
export const SECURE_STORE_CHUNK_SIZE = 1800;

/** SecureStore допускает в ключах только [A-Za-z0-9._-]. */
const toSafeKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, '_');
const countKey = (key: string): string => `${toSafeKey(key)}.count`;
const chunkKey = (key: string, index: number): string => `${toSafeKey(key)}.${index}`;
const queues = new WeakMap<SecureStoreDriver, Map<string, Promise<unknown>>>();
type Manifest = { slot: 'a' | 'b'; count: number };

/**
 * Хранилище сессии поверх SecureStore (FR1.2): Keychain на iOS, Keystore на Android.
 * Новый слот записывается целиком до переключения manifest. Старый числовой
 * счётчик поддерживается до первой успешной записи в новом формате.
 */
export const createChunkedSecureStorage = (
  driver: SecureStoreDriver = SecureStore,
  chunkSize: number = SECURE_STORE_CHUNK_SIZE,
): KeyValueStorage => {
  if (!Number.isSafeInteger(chunkSize) || chunkSize < 4)
    throw new Error('SecureStore chunk size must be at least 4 bytes');
  const pending = queues.get(driver) ?? new Map<string, Promise<unknown>>();
  queues.set(driver, pending);
  const serial = <T>(key: string, operation: () => Promise<T>): Promise<T> => {
    const safe = toSafeKey(key);
    const next = (pending.get(safe) ?? Promise.resolve()).catch(() => undefined).then(operation);
    pending.set(safe, next);
    void next
      .finally(() => {
        if (pending.get(safe) === next) pending.delete(safe);
      })
      .catch(() => undefined);
    return next;
  };
  const readManifest = async (key: string): Promise<Manifest | number> => {
    const raw = await driver.getItemAsync(countKey(key));
    if (raw === null) return 0;
    try {
      const value: unknown = JSON.parse(raw);
      if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : 0;
      if (
        typeof value === 'object' &&
        value !== null &&
        'slot' in value &&
        'count' in value &&
        (value.slot === 'a' || value.slot === 'b') &&
        typeof value.count === 'number' &&
        Number.isSafeInteger(value.count) &&
        value.count > 0
      )
        return { slot: value.slot, count: value.count };
    } catch {
      return 0;
    }
    return 0;
  };
  const clearChunks = async (key: string, manifest: Manifest | number) => {
    const count = typeof manifest === 'number' ? manifest : manifest.count;
    const base = typeof manifest === 'number' ? key : `${key}.${manifest.slot}`;
    await Promise.all(
      Array.from({ length: count }, (_, index) => driver.deleteItemAsync(chunkKey(base, index))),
    );
    if (typeof manifest !== 'number') await driver.deleteItemAsync(countKey(base));
  };
  const clearSlot = async (key: string, slot: 'a' | 'b') => {
    const raw = await driver.getItemAsync(countKey(`${key}.${slot}`));
    const count = Number(raw);
    if (Number.isSafeInteger(count) && count > 0) await clearChunks(key, { slot, count });
  };
  const removeItem = async (key: string) => {
    const manifest = await readManifest(key);
    await driver.deleteItemAsync(countKey(key));
    await clearChunks(key, manifest);
    await clearSlot(key, 'a');
    await clearSlot(key, 'b');
  };

  return {
    getItem: (key) =>
      serial(key, async () => {
        const manifest = await readManifest(key);
        const count = typeof manifest === 'number' ? manifest : manifest.count;
        if (count === 0) {
          return null;
        }
        const chunks = await Promise.all(
          Array.from({ length: count }, (_, index) =>
            driver.getItemAsync(
              chunkKey(typeof manifest === 'number' ? key : `${key}.${manifest.slot}`, index),
            ),
          ),
        );
        // Если хоть одного куска нет, значение повреждено: лучше «нет сессии», чем битый JSON.
        if (chunks.some((chunk) => chunk === null)) {
          await removeItem(key);
          return null;
        }
        return chunks.join('');
      }),

    setItem: (key, value) =>
      serial(key, async () => {
        const previous = await readManifest(key);
        const slot = typeof previous === 'number' || previous.slot === 'b' ? 'a' : 'b';
        const chunks: string[] = [];
        let chunk = '';
        let bytes = 0;
        for (const character of value) {
          const code = character.codePointAt(0)!;
          const size = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
          if (bytes + size > chunkSize) {
            chunks.push(chunk);
            chunk = '';
            bytes = 0;
          }
          chunk += character;
          bytes += size;
        }
        chunks.push(chunk);
        const manifest: Manifest = { slot, count: chunks.length };
        await clearSlot(key, slot);
        try {
          await driver.setItemAsync(countKey(`${key}.${slot}`), String(chunks.length));
          // Sequential writes ensure rollback cannot race unfinished native writes.
          for (const [index, part] of chunks.entries())
            await driver.setItemAsync(chunkKey(`${key}.${slot}`, index), part);
          await driver.setItemAsync(countKey(key), JSON.stringify(manifest));
        } catch (error) {
          await clearChunks(key, manifest).catch(() => undefined);
          throw error;
        }
        // A cleanup failure must not report a committed token update as failed.
        await clearChunks(key, previous).catch((error: unknown) =>
          console.warn('secure storage cleanup failed', error),
        );
      }),

    removeItem: (key) => serial(key, () => removeItem(key)),
  };
};

/** Минимум от window.localStorage (в тестах подменяется). */
export interface WebStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

/**
 * Хранилище сессии для веб-версии (только для проверки на ПК). SecureStore в браузере нет,
 * поэтому сессия лежит в localStorage — так же поступает сам supabase-js в вебе.
 * В мобильных сборках используется createChunkedSecureStorage (FR1.2).
 */
export const createWebStorage = (storage: WebStorageLike): KeyValueStorage => ({
  getItem: (key) => Promise.resolve(storage.getItem(key)),
  setItem: (key, value) => {
    storage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    storage.removeItem(key);
    return Promise.resolve();
  },
});
