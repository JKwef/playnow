import { createContext, useContext, useMemo } from 'react';

import { darkColors, themePalettes, type ThemeColors } from '@/shared/constants/colors';

export type ThemeMode = keyof typeof themePalettes;

export const isThemeMode = (value: string | null): value is ThemeMode =>
  value !== null && Object.hasOwn(themePalettes, value);

export const isSpectrumMode = (mode: ThemeMode): mode is 'spectrum' | 'spectrumLight' =>
  mode === 'spectrum' || mode === 'spectrumLight';

export const themeColorScheme = (mode: ThemeMode): 'dark' | 'light' =>
  mode === 'light' || mode === 'glass' || mode === 'spectrumLight' ? 'light' : 'dark';

export interface AppTheme {
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  persistenceError: string | null;
}

export const ThemeContext = createContext<AppTheme>({
  mode: 'dark',
  colors: darkColors,
  setMode: async () => undefined,
  persistenceError: null,
});

export const useTheme = (): AppTheme => useContext(ThemeContext);
export const useThemeColors = (): ThemeColors => useTheme().colors;

/** Фабрика статична; стили пересоздаются только при смене палитры. */
export const useThemedStyles = <T>(factory: (colors: ThemeColors) => T): T => {
  const colors = useThemeColors();
  return useMemo(() => factory(colors), [colors, factory]);
};
