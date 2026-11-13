import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { ThemeColors } from '@/shared/constants/colors';
import type { ThemeMode } from '@/shared/theme/useTheme';

/** Тема React Navigation на основе палитры UI1 (шапки, фон, разделители). */
export const createNavigationTheme = (mode: ThemeMode, colors: ThemeColors): Theme => ({
  ...(mode === 'dark' ? DarkTheme : DefaultTheme),
  dark: mode === 'dark',
  colors: {
    ...DarkTheme.colors,
    primary: colors.secondary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.secondary,
  },
});
