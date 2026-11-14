import { fontFamily } from '@/shared/constants';
import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

import type { ThemeColors } from '@/shared/constants/colors';
import { themeColorScheme, type ThemeMode } from '@/shared/theme/useTheme';

/** Тема React Navigation на основе палитры UI1 (шапки, фон, разделители). */
export const createNavigationTheme = (mode: ThemeMode, colors: ThemeColors): Theme => ({
  ...(themeColorScheme(mode) === 'dark' ? DarkTheme : DefaultTheme),
  dark: themeColorScheme(mode) === 'dark',
  fonts: {
    regular: { fontFamily: fontFamily.regular, fontWeight: 'normal' },
    medium: { fontFamily: fontFamily.regular, fontWeight: 'normal' },
    bold: { fontFamily: fontFamily.bold, fontWeight: 'normal' },
    heavy: { fontFamily: fontFamily.bold, fontWeight: 'normal' },
  },
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
