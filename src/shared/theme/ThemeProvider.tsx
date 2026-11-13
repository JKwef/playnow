import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { darkColors, lightColors } from '@/shared/constants/colors';

import { ThemeContext, type ThemeMode } from './useTheme';

export const THEME_STORAGE_KEY = 'quaeso:theme';

export interface ThemeStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

export function ThemeProvider({
  children,
  storage = AsyncStorage,
}: {
  children: ReactNode;
  storage?: ThemeStorage;
}) {
  const [mode, setCurrentMode] = useState<ThemeMode>('dark');
  const [ready, setReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const version = useRef(0);

  useEffect(() => {
    let active = true;
    const initialVersion = version.current;
    void storage
      .getItem(THEME_STORAGE_KEY)
      .then((saved) => {
        if (active && version.current === initialVersion && (saved === 'light' || saved === 'dark'))
          setCurrentMode(saved);
      })
      .catch((error: unknown) => console.warn('theme restore failed', error))
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [storage]);

  const setMode = useCallback(
    async (next: ThemeMode) => {
      const request = ++version.current;
      setCurrentMode(next);
      setPersistenceError(null);
      // Порядок быстрых переключений сохраняется и на диске.
      const write = writeQueue.current
        .catch(() => undefined)
        .then(() => storage.setItem(THEME_STORAGE_KEY, next));
      writeQueue.current = write;
      try {
        await write;
      } catch (error) {
        console.warn('theme save failed', error);
        if (version.current === request)
          setPersistenceError('Тема изменена, но сохранить выбор не удалось.');
      }
    },
    [storage],
  );

  const value = useMemo(
    () => ({
      mode,
      colors: mode === 'light' ? lightColors : darkColors,
      setMode,
      persistenceError,
    }),
    [mode, setMode, persistenceError],
  );

  return (
    <ThemeContext.Provider value={value}>
      {ready ? children : <View style={{ flex: 1, backgroundColor: darkColors.background }} />}
    </ThemeContext.Provider>
  );
}
