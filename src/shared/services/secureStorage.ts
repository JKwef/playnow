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
 * Размер одного куска. SecureStore исторически предупреждает о значениях > 2048 байт
 * (на части Android-устройств запись больших значений падает), а сессия Supabase
 * с JWT и refresh token обычно 2–4 КБ. Берём с запасом под многобайтовые символы.
 */
export const SECURE_STORE_CHUNK_SIZE = 1800;

/** SecureStore допускает в ключах только [A-Za-z0-9._-]. */
const toSafeKey = (key: string): string => key.replace(/[^A-Za-z0-9._-]/g, '_');
const countKey = (key: string): string => `${toSafeKey(key)}.count`;
const chunkKey = (key: string, index: number): string => `${toSafeKey(key)}.${index}`;

/**
 * Хранилище сессии поверх SecureStore (FR1.2): Keychain на iOS, Keystore на Android.
 * Длинные значения режутся на куски `<key>.0..N`, количество кусков лежит в `<key>.count`.
 */
export const createChunkedSecureStorage = (
  driver: SecureStoreDriver = SecureStore,
  chunkSize: number = SECURE_STORE_CHUNK_SIZE,
): KeyValueStorage => {
  const readCount = async (key: string): Promise<number> => {
    const raw = await driver.getItemAsync(countKey(key));
    const count = raw === null ? 0 : Number.parseInt(raw, 10);
    return Number.isSafeInteger(count) && count > 0 ? count : 0;
  };

  const removeItem = async (key: string): Promise<void> => {
    const count = await readCount(key);
    // Сначала счётчик: если удаление кусков прервётся, getItem уже вернёт null, а не обрывок.
    await driver.deleteItemAsync(countKey(key));
    await Promise.all(
      Array.from({ length: count }, (_, index) => driver.deleteItemAsync(chunkKey(key, index))),
    );
  };

  return {
    getItem: async (key) => {
      const count = await readCount(key);
      if (count === 0) {
        return null;
      }
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) => driver.getItemAsync(chunkKey(key, index))),
      );
      // Если хоть одного куска нет, значение повреждено: лучше «нет сессии», чем битый JSON.
      if (chunks.some((chunk) => chunk === null)) {
        await removeItem(key);
        return null;
      }
      return chunks.join('');
    },

    setItem: async (key, value) => {
      // Стираем старое значение: новое может состоять из меньшего числа кусков.
      await removeItem(key);
      const chunks: string[] = [];
      for (let offset = 0; offset < value.length; offset += chunkSize) {
        chunks.push(value.slice(offset, offset + chunkSize));
      }
      await Promise.all(
        chunks.map((chunk, index) => driver.setItemAsync(chunkKey(key, index), chunk)),
      );
      // Счётчик пишем последним: до этого момента значение считается отсутствующим.
      await driver.setItemAsync(countKey(key), String(chunks.length));
    },

    removeItem,
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
