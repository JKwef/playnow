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

    expect(driver.data.get('sb-auth_token.count')).toBe('{"slot":"a","count":3}');
    expect(driver.data.get('sb-auth_token.a.0')).toBe('abcd');
    expect(await storage.getItem('sb-auth:token')).toBe('abcdefghij');
  });

  test('новое короткое значение не оставляет хвостов старого', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    await storage.setItem('k', 'abcdefghij');
    await storage.setItem('k', 'xy');

    expect(await storage.getItem('k')).toBe('xy');
    expect([...driver.data.keys()].sort()).toEqual(['k.b.0', 'k.b.count', 'k.count']);
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
    driver.data.delete('k.a.1');

    expect(await storage.getItem('k')).toBeNull();
    expect(driver.data.size).toBe(0);
  });

  test('removeItem удаляет счётчик и все куски', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    await storage.setItem('k', 'abcdef');
    await storage.removeItem('k');

    expect(driver.data.size).toBe(0);
  });

  test.each(['k.b.1', 'k.count'])(
    'failed write at %s preserves the committed session',
    async (failedKey) => {
      const driver = memoryDriver();
      const storage = createChunkedSecureStorage(driver, 4);
      await storage.setItem('k', 'old-session');
      const write = driver.setItemAsync;
      driver.setItemAsync = (key, value) =>
        key === failedKey ? Promise.reject(new Error('disk full')) : write(key, value);
      await expect(storage.setItem('k', 'new-session')).rejects.toThrow('disk full');
      expect(await createChunkedSecureStorage(driver, 4).getItem('k')).toBe('old-session');
      expect([...driver.data.keys()].some((key) => key.startsWith('k.b.'))).toBe(false);
    },
  );

  test('reads legacy chunks and migrates only after a successful commit', async () => {
    const driver = memoryDriver();
    driver.data.set('k.count', '2');
    driver.data.set('k.0', 'old-');
    driver.data.set('k.1', 'token');
    const storage = createChunkedSecureStorage(driver, 4);
    expect(await storage.getItem('k')).toBe('old-token');
    const write = driver.setItemAsync;
    driver.setItemAsync = (key, value) =>
      key === 'k.count' ? Promise.reject(new Error('disk full')) : write(key, value);
    await expect(storage.setItem('k', 'new-token')).rejects.toThrow();
    expect(await storage.getItem('k')).toBe('old-token');
    driver.setItemAsync = write;
    await storage.setItem('k', 'new-token');
    expect(await storage.getItem('k')).toBe('new-token');
    expect(driver.data.has('k.0')).toBe(false);
  });

  test('serializes concurrent updates and deletion across storage instances', async () => {
    const driver = memoryDriver();
    const first = createChunkedSecureStorage(driver, 4);
    const second = createChunkedSecureStorage(driver, 4);
    await Promise.all([first.setItem('k', 'first-token'), second.setItem('k', 'second-token')]);
    expect(await first.getItem('k')).toBe('second-token');
    await Promise.all([first.setItem('k', 'third-token'), second.removeItem('k')]);
    expect(await first.getItem('k')).toBeNull();
    expect(driver.data.size).toBe(0);
  });

  test('keeps Unicode chunks within the byte limit and supports empty values', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    await storage.setItem('k', 'Я🎮界ab');
    expect(await storage.getItem('k')).toBe('Я🎮界ab');
    for (const [key, value] of driver.data) {
      if (/\.a\.\d+$/.test(key)) expect(Buffer.byteLength(value, 'utf8')).toBeLessThanOrEqual(4);
    }
    await storage.setItem('k', '');
    expect(await storage.getItem('k')).toBe('');
  });

  test('removes staging chunks left by an interrupted process', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    await storage.setItem('k', 'old-token');
    driver.data.set('k.b.count', '2');
    driver.data.set('k.b.0', 'part');
    expect(await storage.getItem('k')).toBe('old-token');
    await storage.removeItem('k');
    expect(driver.data.size).toBe(0);
  });

  test('a cleanup error after commit keeps the new session and can be retried', async () => {
    const driver = memoryDriver();
    const storage = createChunkedSecureStorage(driver, 4);
    await storage.setItem('k', 'old-token');
    const remove = driver.deleteItemAsync;
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      driver.deleteItemAsync = (key) =>
        key === 'k.a.0' ? Promise.reject(new Error('cleanup failed')) : remove(key);
      await expect(storage.setItem('k', 'new-token')).resolves.toBeUndefined();
      expect(await storage.getItem('k')).toBe('new-token');
      expect(warning).toHaveBeenCalled();
      driver.deleteItemAsync = remove;
      await storage.removeItem('k');
      expect(driver.data.size).toBe(0);
    } finally {
      warning.mockRestore();
    }
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
