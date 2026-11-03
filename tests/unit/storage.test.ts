import {
  createChunkedSecureStorage,
  createWebStorage,
  type SecureStoreDriver,
} from '@/shared/services/secureStorage';

/** SecureStore в памяти: ключи и значения видны тесту напрямую. */
const memoryDriver = (): SecureStoreDriver & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: (key) => Promise.resolve(data.get(key) ?? null),
    setItemAsync: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key) => {
      data.delete(key);
      return Promise.resolve();
    },
  };
};

describe('createChunkedSecureStorage (FR1.2)', () => {
  test('режет длинное значение на куски и собирает обратно', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    await storage.setItem('sb-auth:token', 'abcdefghij');

    expect(driver.data.get('sb-auth_token.count')).toBe('3');
    expect(driver.data.get('sb-auth_token.0')).toBe('abcd');
    expect(await storage.getItem('sb-auth:token')).toBe('abcdefghij');
  });

  test('новое короткое значение не оставляет хвостов старого', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    await storage.setItem('k', 'abcdefghij');
    await storage.setItem('k', 'xy');

    expect(await storage.getItem('k')).toBe('xy');
    expect([...driver.data.keys()].sort()).toEqual(['k.0', 'k.count']);
  });

  test('нет значения или битый счётчик — null', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    expect(await storage.getItem('missing')).toBeNull();

    driver.data.set('k.count', 'abc');
    expect(await storage.getItem('k')).toBeNull();
  });

  test('потерянный кусок: значение считается повреждённым и стирается', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    await storage.setItem('k', 'abcdefgh');
    driver.data.delete('k.1');

    expect(await storage.getItem('k')).toBeNull();
    expect(driver.data.size).toBe(0);
  });

  test('removeItem удаляет счётчик и все куски', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 2);
    await storage.setItem('k', 'abcdef');
    await storage.removeItem('k');

    expect(driver.data.size).toBe(0);
  });
});

describe('createWebStorage', () => {
  test('проксирует в localStorage-подобное хранилище', async () => {
    const data = new Map<string, string>();
    const storage = createWebStorage({
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
      removeItem: (key) => void data.delete(key),
    });

    await storage.setItem('a', '1');
    expect(await storage.getItem('a')).toBe('1');
    await storage.removeItem('a');
    expect(await storage.getItem('a')).toBeNull();
  });
});
