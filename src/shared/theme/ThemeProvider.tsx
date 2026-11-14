import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { darkColors, lightColors, themePalettes } from '@/shared/constants/colors';

import { isSpectrumMode, isThemeMode, ThemeContext, type ThemeMode } from './useTheme';

export const THEME_STORAGE_KEY = 'quaeso:theme';
const HUE_KEY = 'quaeso:theme-hue';
export const supportsSpectrum = () =>
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.matchMedia?.('(pointer: fine)').matches === true;

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
  const [hue, setHue] = useState(150);
  const [ready, setReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const version = useRef(0);

  useEffect(() => {
    let active = true;
    const initialVersion = version.current;
    void Promise.all([
      storage.getItem(THEME_STORAGE_KEY),
      ...(supportsSpectrum() ? [storage.getItem(HUE_KEY)] : []),
    ])
      .then(([saved, savedHue]) => {
        if (!active || version.current !== initialVersion) return;
        if (
          saved !== undefined &&
          isThemeMode(saved) &&
          (!isSpectrumMode(saved) || supportsSpectrum())
        )
          setCurrentMode(saved);
        if (savedHue && /^\d{1,3}$/.test(savedHue)) setHue(Number(savedHue) % 360);
      })
      .catch((error: unknown) => console.warn('theme restore failed', error))
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [storage]);

  useEffect(() => {
    if (!isSpectrumMode(mode) || !supportsSpectrum()) return;
    const changeHue = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      if (
        event.target instanceof Element &&
        event.target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      event.preventDefault();
      setHue((value) => (value + (event.key === 'ArrowUp' ? 1 : 359)) % 360);
    };
    window.addEventListener('keydown', changeHue);
    return () => window.removeEventListener('keydown', changeHue);
  }, [mode]);

  useEffect(() => {
    if (ready && isSpectrumMode(mode)) {
      writeQueue.current = writeQueue.current
        .catch(() => undefined)
        .then(() => storage.setItem(HUE_KEY, String(hue)))
        .catch(() => setPersistenceError('Не удалось сохранить оттенок.'));
    }
  }, [hue, mode, ready, storage]);

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
      colors:
        mode === 'spectrum'
          ? {
              ...darkColors,
              background: `hsl(${hue}, 32%, 8%)`,
              surface: `hsl(${hue}, 29%, 14%)`,
              elevated: `hsl(${hue}, 28%, 19%)`,
              mintMuted: `hsl(${hue}, 36%, 22%)`,
              border: `hsl(${hue}, 25%, 33%)`,
              primary: `hsl(${hue}, 84%, 75%)`,
              secondary: `hsl(${hue}, 84%, 75%)`,
              onPrimary: '#10151a',
            }
          : mode === 'spectrumLight'
            ? {
                ...lightColors,
                background: `hsl(${hue}, 44%, 96%)`,
                surface: `hsl(${hue}, 38%, 99%)`,
                elevated: `hsl(${hue}, 36%, 91%)`,
                mintMuted: `hsl(${hue}, 48%, 87%)`,
                border: `hsl(${hue}, 25%, 72%)`,
                primary: `hsl(${hue}, 72%, 22%)`,
                secondary: `hsl(${hue}, 72%, 22%)`,
              }
            : themePalettes[mode],
      setMode,
      persistenceError,
    }),
    [mode, hue, setMode, persistenceError],
  );

  return (
    <ThemeContext.Provider value={value}>
      {ready ? children : <View style={{ flex: 1, backgroundColor: darkColors.background }} />}
    </ThemeContext.Provider>
  );
}
