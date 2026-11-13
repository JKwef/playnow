import { createContext, useContext, useMemo } from 'react';

import { darkColors, type ThemeColors } from '@/shared/constants/colors';

export type ThemeMode = 'dark' | 'light';

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
